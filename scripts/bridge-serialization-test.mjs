#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_KEYS_URL = "https://app.nitrosend.com/my/settings/api-keys";

await testAuthGuidanceUsesCanonicalSettingsUrl();
await testSerializedForwarding();
await testBridgeGeneratedErrorPreservesId();
await testToolCallIsNeverReplayedAfterServerError();

async function testAuthGuidanceUsesCanonicalSettingsUrl() {
  for (const authEnv of [
    { NITROSEND_API_KEY: "invalid-key" },
    {},
  ]) {
    const { code, stderr } = await runBridgeForAuthError(authEnv);

    assert.equal(code, 1, stderr);
    assert.ok(stderr.includes(API_KEYS_URL), stderr);
    assert.ok(!stderr.includes("/my/brand/api-keys"), stderr);
  }
}

async function testSerializedForwarding() {
  let requests = 0;
  let firstResponse;
  let firstReleased = false;
  let secondBeforeFirstRelease = false;
  let firstReceivedResolve;
  const firstReceived = new Promise((resolvePromise) => {
    firstReceivedResolve = resolvePromise;
  });

  const server = await startServer((req, res) => {
    collectBody(req, () => {
      requests += 1;

      if (requests === 1) {
        firstResponse = res;
        firstReceivedResolve();
        return;
      }

      if (!firstReleased) {
        secondBeforeFirstRelease = true;
      }

      respondJson(res, {
        jsonrpc: "2.0",
        result: { ok: true, request: requests },
        id: 2,
      });
    });
  });

  const bridge = spawnBridge(server.url);

  bridge.write({ jsonrpc: "2.0", method: "first", id: 1 });
  bridge.write({ jsonrpc: "2.0", method: "second", id: 2 });

  await firstReceived;
  await sleep(150);

  assert.equal(requests, 1, "second request reached upstream before first response completed");
  assert.equal(secondBeforeFirstRelease, false);

  firstReleased = true;
  respondJson(firstResponse, {
    jsonrpc: "2.0",
    result: { ok: true, request: 1 },
    id: 1,
  });

  const lines = await bridge.waitForLines(2);
  assert.deepEqual(lines.map((line) => JSON.parse(line).id), [1, 2]);

  bridge.end();
  await bridge.waitForExit();
  await server.close();
}

async function testBridgeGeneratedErrorPreservesId() {
  const server = await startServer((req, res) => {
    collectBody(req, () => {
      res.writeHead(418);
      res.end("teapot");
    });
  });

  const bridge = spawnBridge(server.url);
  bridge.write({ jsonrpc: "2.0", method: "status", id: "status-check" });

  const [line] = await bridge.waitForLines(1);
  const response = JSON.parse(line);

  assert.equal(response.id, "status-check");
  assert.equal(response.error.code, -32000);
  assert.equal(response.error.message, "API returned 418");

  bridge.end();
  await bridge.waitForExit();
  await server.close();
}

async function testToolCallIsNeverReplayedAfterServerError() {
  let requests = 0;
  const server = await startServer((req, res) => {
    collectBody(req, () => {
      requests += 1;
      res.writeHead(503);
      res.end("unavailable after an indeterminate tool outcome");
    });
  });

  const bridge = spawnBridge(server.url);
  bridge.write({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "nitro_send_message",
      arguments: { idempotency_key: "bridge-proof" },
    },
    id: "tool-call",
  });

  const [line] = await bridge.waitForLines(1);
  const response = JSON.parse(line);
  await sleep(500);

  assert.equal(requests, 1, "bridge replayed an indeterminate mutating tool call");
  assert.equal(response.id, "tool-call");
  assert.equal(response.error.message, "API returned 503");

  bridge.end();
  await bridge.waitForExit();
  await server.close();
}

async function startServer(handler) {
  const server = http.createServer(handler);

  await new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = server.address();
  assert(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}

function spawnBridge(apiUrl) {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      NITROSEND_API_URL: apiUrl,
      NITROSEND_API_KEY: "nskey_live_testbridge",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  return {
    write(payload) {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    },
    end() {
      child.stdin.end();
    },
    async waitForLines(count) {
      await waitFor(() => outputLines(stdout).length >= count, `bridge stdout lines >= ${count}`);
      return outputLines(stdout).slice(0, count);
    },
    async waitForExit() {
      const [code] = await once(child, "exit");
      assert.equal(code, 0, stderr);
    },
  };
}

async function runBridgeForAuthError(authEnv) {
  const env = { ...process.env };
  delete env.NITROSEND_API_KEY;
  delete env.NITROSEND_BEARER_TOKEN;
  Object.assign(env, authEnv);

  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const [code] = await once(child, "exit");
  return { code, stderr };
}

function collectBody(req, callback) {
  req.resume();
  req.on("end", callback);
}

function respondJson(res, payload) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function outputLines(output) {
  return output.split("\n").filter(Boolean);
}

async function waitFor(predicate, description, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${description}`);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
