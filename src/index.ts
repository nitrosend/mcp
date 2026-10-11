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

type EmitMessage = (message: string) => Promise<void>;

async function forward(line: string, emit: EmitMessage): Promise<void> {
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
      return;
    }

    if (res.ok) {
      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("text/event-stream")) {
        await forwardEventStream(res, requestId, emit);
        return;
      }

      const text = await res.text();
      if (text) {
        await emit(text);
      }
      return;
    }

    if (res.status === 401 || res.status === 403) {
      const authHint = mode === "bearer"
        ? "Check your NITROSEND_BEARER_TOKEN (may be expired — re-authenticate via OAuth)"
        : "Check your NITROSEND_API_KEY";
      console.error(`Auth error (${res.status}): ${authHint}`);
      await emit(jsonRpcError(-32000, `Authentication failed (${res.status})`, requestId));
      return;
    }

    await emit(jsonRpcError(-32000, `API returned ${res.status}`, requestId));
  } catch (err) {
    const message = (err as Error).message || "Unknown network error";
    console.error(`Network error: ${message}`);
    await emit(jsonRpcError(-32000, `Network error: ${message}`, requestId));
  }
}

// A Streamable HTTP server may answer a POST with an SSE stream that carries
// related notifications before the final response. Each event's data is one
// JSON-RPC message; re-serialize it so stdout stays one message per line no
// matter how the server framed the event.
async function forwardEventStream(
  res: Response,
  requestId: JsonRpcId,
  emit: EmitMessage
): Promise<void> {
  let respondedToRequest = requestId === null;
  let dataLines: string[] = [];

  const dispatch = async (): Promise<void> => {
    if (dataLines.length === 0) return;
    const data = dataLines.join("\n");
    dataLines = [];

    let message: unknown;
    try {
      message = JSON.parse(data);
    } catch {
      console.error("Ignoring non-JSON event stream data");
      return;
    }

    if (
      message !== null &&
      typeof message === "object" &&
      (message as { id?: unknown }).id === requestId
    ) {
      respondedToRequest = true;
    }

    await emit(JSON.stringify(message));
  };

  const handleLine = async (rawLine: string): Promise<void> => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line === "") {
      await dispatch();
      return;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
    }
    // event:, id:, retry: and comment lines carry no JSON-RPC payload
  };

  try {
    if (res.body) {
      const decoder = new TextDecoder();
      let buffered = "";

      for await (const chunk of res.body) {
        buffered += decoder.decode(chunk as Uint8Array, { stream: true });

        let newline: number;
        while ((newline = buffered.indexOf("\n")) !== -1) {
          const rawLine = buffered.slice(0, newline);
          buffered = buffered.slice(newline + 1);
          await handleLine(rawLine);
        }
      }

      buffered += decoder.decode();
      if (buffered) {
        await handleLine(buffered);
      }
      await dispatch();
    }
  } catch (err) {
    console.error(`Event stream error: ${(err as Error).message}`);
  }

  if (!respondedToRequest) {
    // The stream closed without answering the request; fail closed so the
    // client is not left waiting on an id that will never resolve.
    await emit(
      jsonRpcError(-32000, "Event stream ended before a response arrived", requestId)
    );
  }
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
  await forward(line, async (message) => {
    await writeStdout(message + "\n");
  });
}

async function writeStdout(text: string): Promise<void> {
  if (!process.stdout.write(text)) {
    await once(process.stdout, "drain");
  }
}

console.error(`Nitrosend MCP bridge started (${apiUrl}, auth=${mode})`);
