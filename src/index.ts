#!/usr/bin/env node

import { createRequire } from "node:module";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { getAuthConfig, getApiUrl } from "./auth.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };

const { token, mode, brandSid } = getAuthConfig();
const apiUrl = getApiUrl();
const userAgent = `nitrosend-mcp/${packageJson.version || "unknown"}`;
let mcpSessionId: string | undefined;

type JsonRpcId = string | number | null;

async function forward(line: string): Promise<string> {
  const requestId = extractRequestId(line);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
    };

    if (brandSid) {
      headers["X-Brand-SID"] = brandSid;
    }

    if (mcpSessionId) {
      headers["Mcp-Session-Id"] = mcpSessionId;
    }

    // Never replay a JSON-RPC POST inside the bridge. A network failure or
    // 5xx can arrive after the API committed a mutating tools/call, so only
    // the caller can safely retry with the tool's explicit idempotency key.
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
      return decodeBody(await res.text(), res.headers.get("Content-Type"));
    }

    if (res.status === 401 || res.status === 403) {
      const authHint = mode === "bearer"
        ? "Check your NITROSEND_BEARER_TOKEN (may be expired — re-authenticate via OAuth)"
        : "Check your NITROSEND_API_KEY";
      console.error(`Auth error (${res.status}): ${authHint}`);
      return jsonRpcError(-32000, `Authentication failed (${res.status})`, requestId);
    }

    return jsonRpcError(-32000, `API returned ${res.status}`, requestId);
  } catch (err) {
    const message = (err as Error).message || "Unknown network error";
    console.error(`Network error: ${message}`);
    return jsonRpcError(-32000, `Network error: ${message}`, requestId);
  }
}

// The Streamable HTTP spec REQUIRES this client to advertise
// `text/event-stream` in Accept — the API rejects the POST outright without it
// ("Not Acceptable") — so the bridge must also be prepared to receive one.
// Any request carrying an Mcp-Session-Id is served by the API's stateful
// transport, which replies with SSE rather than plain JSON. Writing those
// frames to stdout verbatim emits `data: {...}` where the host expects a bare
// JSON-RPC line; every stdio host reads that as a parse error, so the server
// connects and then exposes zero usable tools. Unwrap the frames back into
// newline-delimited JSON-RPC.
function decodeBody(body: string, contentType: string | null): string {
  if (!contentType?.toLowerCase().includes("text/event-stream")) {
    return body;
  }

  const messages: string[] = [];
  // Events are separated by a blank line; `data:` may repeat within one event
  // and its parts are joined with newlines (per the SSE spec).
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");

    if (data.trim()) messages.push(data);
  }

  return messages.join("\n");
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
