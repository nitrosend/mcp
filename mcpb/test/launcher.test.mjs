import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  REMOTE_URL,
  AUTH_ENV_VAR,
  validateApiKey,
  buildProxyArgs,
  buildProxyEnv,
  planLaunch,
  resolveProxyEntry,
} from '../server/index.js';

const KEY = 'nskey_live_abc123XYZ456';

// A minimal env base: planLaunch must never depend on ambient process.env.
const base = { HOME: os.homedir() };

test('remote URL is the production MCP endpoint', () => {
  assert.equal(REMOTE_URL, 'https://api.nitrosend.com/mcp');
});

test('OAuth default: URL + http-only transport, no header args, no auth env', () => {
  const { args, childEnv, warnings } = planLaunch({ ...base });
  assert.deepEqual(args, [REMOTE_URL, '--transport', 'http-only']);
  assert.equal(childEnv[AUTH_ENV_VAR], undefined);
  assert.deepEqual(warnings, []);
});

test('valid api key: header template in argv, secret only in child env', () => {
  const { args, childEnv, warnings } = planLaunch({ ...base, NITROSEND_API_KEY: KEY });
  assert.ok(args.includes('--header'));
  assert.equal(args[args.indexOf('--header') + 1], `Authorization:\${${AUTH_ENV_VAR}}`);
  // the secret itself must never appear in argv
  assert.ok(!args.join(' ').includes(KEY));
  assert.equal(childEnv[AUTH_ENV_VAR], `Bearer ${KEY}`);
  // and must not be forwarded under its original name
  assert.equal(childEnv.NITROSEND_API_KEY, undefined);
  assert.deepEqual(warnings, []);
});

test('valid key with surrounding whitespace is trimmed', () => {
  const { childEnv } = planLaunch({ ...base, NITROSEND_API_KEY: `  ${KEY}\n` });
  assert.equal(childEnv[AUTH_ENV_VAR], `Bearer ${KEY}`);
});

test('omitted / empty / whitespace key means OAuth mode, silently', () => {
  for (const env of [
    { ...base },
    { ...base, NITROSEND_API_KEY: '' },
    { ...base, NITROSEND_API_KEY: '   ' },
    { ...base, NITROSEND_API_KEY: '\n\t' },
  ]) {
    const { args, childEnv, warnings } = planLaunch(env);
    assert.ok(!args.includes('--header'), JSON.stringify(env));
    assert.equal(childEnv[AUTH_ENV_VAR], undefined);
    assert.deepEqual(warnings, []);
  }
});

test('unresolved ${user_config.api_key} template falls back to OAuth with one generic warning', () => {
  const raw = '${user_config.api_key}';
  const { args, childEnv, warnings } = planLaunch({ ...base, NITROSEND_API_KEY: raw });
  assert.ok(!args.includes('--header'));
  assert.equal(childEnv[AUTH_ENV_VAR], undefined);
  assert.equal(warnings.length, 1);
  assert.ok(!warnings[0].includes(raw));
});

test('malformed keys fall back to OAuth with a warning that never echoes the value', () => {
  const bad = [
    'short',                          // too short
    `${'x'.repeat(600)}`,             // too long
    `nskey_live_abc\ndef`,            // LF
    `nskey_live_abc\rdef`,            // CR
    'nskey_live abc',                 // interior space
    'nskey_live_abc\u0000def',       // NUL
    'nskey_live_abcé',                // non-ASCII
    'nskey_${PATH}_abcdefgh',         // template residue
  ];
  for (const raw of bad) {
    const { args, childEnv, warnings } = planLaunch({ ...base, NITROSEND_API_KEY: raw });
    assert.ok(!args.includes('--header'), JSON.stringify(raw));
    assert.equal(childEnv[AUTH_ENV_VAR], undefined, JSON.stringify(raw));
    assert.equal(warnings.length, 1, JSON.stringify(raw));
    assert.ok(!warnings[0].includes(raw.trim()), JSON.stringify(raw));
  }
});

test('validateApiKey mirrors planLaunch decisions', () => {
  assert.equal(validateApiKey(KEY), KEY);
  assert.equal(validateApiKey(` ${KEY} `), KEY);
  assert.equal(validateApiKey(undefined), null);
  assert.equal(validateApiKey(''), null);
  assert.equal(validateApiKey('short'), null);
  assert.equal(validateApiKey('has space_but_long_enough'), null);
  assert.equal(validateApiKey('${user_config.api_key}'), null);
});

test('proxy env vars enable --enable-proxy', () => {
  for (const v of ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'https_proxy', 'http_proxy', 'all_proxy']) {
    const { args } = planLaunch({ ...base, [v]: 'http://proxy.corp:8080' });
    assert.ok(args.includes('--enable-proxy'), v);
  }
  const { args } = planLaunch({ ...base });
  assert.ok(!args.includes('--enable-proxy'));
});

test('OAuth cache dir defaults to ~/.nitrosend/mcpb-auth and respects an override', () => {
  const { childEnv } = planLaunch({ ...base });
  assert.equal(childEnv.MCP_REMOTE_CONFIG_DIR, path.join(os.homedir(), '.nitrosend', 'mcpb-auth'));
  const { childEnv: overridden } = planLaunch({ ...base, MCP_REMOTE_CONFIG_DIR: '/tmp/custom-auth' });
  assert.equal(overridden.MCP_REMOTE_CONFIG_DIR, '/tmp/custom-auth');
});

test('buildProxyArgs / buildProxyEnv wrappers agree with planLaunch', () => {
  const env = { ...base, NITROSEND_API_KEY: KEY, HTTPS_PROXY: 'http://p:1' };
  const plan = planLaunch(env);
  assert.deepEqual(buildProxyArgs(env), plan.args);
  assert.deepEqual(buildProxyEnv(env), plan.childEnv);
});

test('resolveProxyEntry points at a real bundled file', () => {
  const entry = resolveProxyEntry();
  assert.ok(entry.endsWith(path.join('mcp-remote', 'dist', 'proxy.js')));
  assert.ok(fs.existsSync(entry));
});
