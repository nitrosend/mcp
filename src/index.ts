#!/usr/bin/env node

import { createRequire } from "node:module";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { getAuthConfig, getApiUrl } from "./auth.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };

const { token, mode, clientAccountSid } = getAuthConfig();
const apiUrl = getApiUrl();
const userAgent = `nitrosend-mcp/${packageJson.version || "unknown"}`;
let mcpSessionId: string | undefined;

const RETRY_DELAYS = [100, 300];

type JsonRpcId = string | number | null;

async function forward(line: string): Promise<string> {
  const requestId = extractRequestId(line);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
      };

      if (clientAccountSid) {
        headers["X-Client-Account-SID"] = clientAccountSid;
      }

      if (mcpSessionId) {
        headers["Mcp-Session-Id"] = mcpSessionId;
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: line,
      });

      const nextSessionId = res.headers.get("Mcp-Session-Id");
      if (nextSessionId) {
        mcpSessionId = nextSessionId;
      }

      if (res.status === 202) {
        // JSON-RPC notification — no response body
        return "";
      }

      if (res.ok) {
        return await res.text();
      }

      // 401/403 — don't retry auth errors
      if (res.status === 401 || res.status === 403) {
        const authHint = mode === "bearer"
          ? "Check your NITROSEND_BEARER_TOKEN (may be expired — re-authenticate via OAuth)"
          : "Check your NITROSEND_API_KEY";
        console.error(`Auth error (${res.status}): ${authHint}`);
        return jsonRpcError(-32000, `Authentication failed (${res.status})`, requestId);
      }

      // 5xx — retry
      if (res.status >= 500 && attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      return jsonRpcError(-32000, `API returned ${res.status}`, requestId);
    } catch (err) {
      lastError = err as Error;

      // Network error — retry
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
    }
  }

  const msg = lastError?.message || "Unknown network error";
  console.error(`Network error: ${msg}`);
  return jsonRpcError(-32000, `Network error: ${msg}`, requestId);
}

function extractRequestId(line: string): JsonRpcId {
  try {
    const payload = JSON.parse(line) as { id?: unknown };
    if (
      typeof payload.id === "string" ||
      typeof payload.id === "number" ||
      payload.id === null
    ) {
      return payload.id;
    }
  } catch {
    // Invalid JSON-RPC requests do not have a reliable id to preserve.
  }

  return null;
}

function jsonRpcError(code: number, message: string, id: JsonRpcId): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    error: { code, message },
    id,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rl = createInterface({ input: process.stdin });
let queue = Promise.resolve();

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  queue = queue
    .then(() => processLine(trimmed))
    .catch((err: Error) => {
      console.error(`Bridge error: ${err.message}`);
    });
});

rl.on("close", () => {
  queue.then(() => process.exit(0));
});

async function processLine(line: string): Promise<void> {
  const response = await forward(line);
  if (response) {
    await writeStdout(response + "\n");
  }
}

async function writeStdout(text: string): Promise<void> {
  if (!process.stdout.write(text)) {
    await once(process.stdout, "drain");
  }
}

console.error(`Nitrosend MCP bridge started (${apiUrl}, auth=${mode})`);
