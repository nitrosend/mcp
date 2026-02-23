#!/usr/bin/env node

import { createInterface } from "node:readline";
import { getApiKey, getApiUrl } from "./auth.js";

const apiKey = getApiKey();
const apiUrl = getApiUrl();

const RETRY_DELAYS = [100, 300];

async function forward(line: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: line,
      });

      if (res.status === 202) {
        // JSON-RPC notification — no response body
        return "";
      }

      if (res.ok) {
        return await res.text();
      }

      // 401/403 — don't retry auth errors
      if (res.status === 401 || res.status === 403) {
        console.error(`Auth error (${res.status}): Check your NITROSEND_API_KEY`);
        return jsonRpcError(-32000, `Authentication failed (${res.status})`);
      }

      // 5xx — retry
      if (res.status >= 500 && attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      return jsonRpcError(-32000, `API returned ${res.status}`);
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
  return jsonRpcError(-32000, `Network error: ${msg}`);
}

function jsonRpcError(code: number, message: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  const response = await forward(trimmed);
  if (response) {
    process.stdout.write(response + "\n");
  }
});

rl.on("close", () => {
  process.exit(0);
});

console.error(`Nitrosend MCP bridge started (${apiUrl})`);
