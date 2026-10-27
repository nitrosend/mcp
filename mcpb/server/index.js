#!/usr/bin/env node
'use strict';

// Nitrosend Desktop Extension launcher.
//
// Claude Desktop runs this file as the extension's MCP server process. It
// spawns the bundled mcp-remote proxy pointed at the production Nitrosend MCP
// endpoint. Everything on stdout belongs to the JSON-RPC stream; all launcher
// diagnostics go to stderr.
//
// Auth modes:
//   - default: browser OAuth, driven entirely by mcp-remote (RFC 8414/9728
//     discovery, dynamic client registration, PKCE). Tokens live under
//     MCP_REMOTE_CONFIG_DIR, defaulted here to ~/.nitrosend/mcpb-auth so this
//     extension never shares state with other mcp-remote installations.
//   - api key: when the optional NITROSEND_API_KEY user setting is present and
//     valid, the key is exported to the child as `Bearer <key>` under
//     NITROSEND_REMOTE_AUTH and referenced from argv only as the literal
//     template `Authorization:${NITROSEND_REMOTE_AUTH}` — mcp-remote expands
//     env references inside header values itself, so the secret never appears
//     in argv, process listings, or mcp-remote's own header logging.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REMOTE_URL = 'https://api.nitrosend.com/mcp';
const AUTH_ENV_VAR = 'NITROSEND_REMOTE_AUTH';

const KEY_MIN_LENGTH = 8;
const KEY_MAX_LENGTH = 512;
// Printable ASCII only — excludes space, CR, LF, NUL, and all other control
// characters, which also blocks HTTP header injection through the key value.
const KEY_CHARSET = /^[\x21-\x7e]+$/;

function validateApiKey(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.length < KEY_MIN_LENGTH || key.length > KEY_MAX_LENGTH) return null;
  if (key.includes('${')) return null; // unresolved ${user_config.api_key} template
  if (!KEY_CHARSET.test(key)) return null;
  return key;
}

function resolveProxyEntry() {
  return require.resolve('mcp-remote/dist/proxy.js');
}

function planLaunch(env) {
  const args = [REMOTE_URL, '--transport', 'http-only'];
  const childEnv = { ...env };
  const warnings = [];

  const rawKey = env.NITROSEND_API_KEY;
  delete childEnv.NITROSEND_API_KEY;
  const key = validateApiKey(rawKey);
  if (key) {
    args.push('--header', `Authorization:\${${AUTH_ENV_VAR}}`);
    childEnv[AUTH_ENV_VAR] = `Bearer ${key}`;
  } else if (typeof rawKey === 'string' && rawKey.trim() !== '') {
    // Present but unusable. Never echo the value or describe what failed in a
    // way that leaks it — one generic line, then continue with browser OAuth.
    warnings.push(
      'ignoring the configured API key (unusable value); continuing with browser OAuth sign-in'
    );
  }

  if (
    env.HTTPS_PROXY || env.https_proxy ||
    env.HTTP_PROXY || env.http_proxy ||
    env.ALL_PROXY || env.all_proxy
  ) {
    args.push('--enable-proxy');
  }

  if (!childEnv.MCP_REMOTE_CONFIG_DIR) {
    childEnv.MCP_REMOTE_CONFIG_DIR = path.join(os.homedir(), '.nitrosend', 'mcpb-auth');
  }

  return { args, childEnv, warnings };
}

function buildProxyArgs(env) {
  return planLaunch(env).args;
}

function buildProxyEnv(env) {
  return planLaunch(env).childEnv;
}

function main() {
  let entry;
  try {
    entry = resolveProxyEntry();
  } catch (err) {
    process.stderr.write(
      'nitrosend-mcpb: bundled mcp-remote dependency is missing or unreadable; reinstall the extension\n'
    );
    process.exit(1);
    return;
  }

  const { args, childEnv, warnings } = planLaunch(process.env);
  for (const warning of warnings) {
    process.stderr.write(`nitrosend-mcpb: ${warning}\n`);
  }

  try {
    fs.mkdirSync(childEnv.MCP_REMOTE_CONFIG_DIR, { recursive: true });
  } catch (err) {
    // mcp-remote creates it itself; this is best-effort pre-creation only.
  }

  // stdio inherit hands the child our exact stdin/stdout, so JSON-RPC flows
  // client<->proxy with no launcher interference and stdin EOF reaches the
  // proxy directly (it exits when the client hangs up).
  const child = spawn(process.execPath, [entry, ...args], {
    env: childEnv,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    process.stderr.write(
      `nitrosend-mcpb: failed to start the bundled proxy: ${err.code || err.message}\n`
    );
    process.exit(1);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      try {
        child.kill(signal);
      } catch (err) {
        // child already gone
      }
    });
  }

  child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : code === null ? 1 : code);
  });
}

module.exports = {
  REMOTE_URL,
  AUTH_ENV_VAR,
  validateApiKey,
  buildProxyArgs,
  buildProxyEnv,
  planLaunch,
  resolveProxyEntry,
};

if (require.main === module) {
  main();
}
