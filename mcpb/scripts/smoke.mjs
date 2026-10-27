// Stdio smoke test for the Nitrosend MCPB (dev-only; excluded from the pack).
//
// Default mode (requires NITROSEND_API_KEY in the environment):
//   node scripts/smoke.mjs --from-artifact dist/nitrosend.mcpb
// Unpacks the built artifact into a scratch directory WITH SPACES in its path,
// drives <unpacked>/server/index.js over stdio with the API key configured,
// performs initialize + tools/list (read-only JSON-RPC only), and asserts:
//   - every stdout line is valid JSON-RPC (stdout purity),
//   - the API key never appears in any live process argv or captured output,
//   - manifest tool names == live tool names minus the account-gated trio,
//     and no gated name appears in the manifest,
//   - the proxy tears down on stdin EOF with no orphan process left.
//
// --oauth-probe: launches the unpacked entry with NO key and an isolated
// MCP_REMOTE_CONFIG_DIR, waits for the OAuth flow to mint an authorize URL
// from live discovery (api.nitrosend.com/oauth/authorize), then terminates.
// No browser completion is attempted.

import { execFileSync, execSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const GATED_TOOLS = new Set(['nitro_manage_outreach', 'nitro_inbox', 'nitro_inbox_action']);
const TIMEOUT_MS = 90_000;

const argv = process.argv.slice(2);
const oauthProbe = argv.includes('--oauth-probe');
const artifactFlag = argv.indexOf('--from-artifact');
const artifact = artifactFlag === -1 ? null : argv[artifactFlag + 1];

const fail = (msg) => {
  console.error(`smoke FAIL: ${msg}`);
  process.exit(1);
};
const ok = (msg) => console.error(`smoke ok: ${msg}`);

// --- resolve the entry point (unpack the artifact into a path with spaces) ---
let baseDir = path.resolve(path.join(import.meta.dirname, '..'));
let cleanupDirs = [];
if (artifact) {
  const unpackRoot = mkdtempSync(path.join(os.tmpdir(), 'nitrosend mcpb smoke '));
  cleanupDirs.push(unpackRoot);
  execFileSync('unzip', ['-q', path.resolve(artifact), '-d', unpackRoot]);
  baseDir = unpackRoot;
  if (!baseDir.includes(' ')) fail('unpack path unexpectedly has no spaces');
  ok(`unpacked artifact into "${baseDir}"`);
}
const entry = path.join(baseDir, 'server', 'index.js');
const manifest = JSON.parse(readFileSync(path.join(baseDir, 'manifest.json'), 'utf8'));
const manifestTools = new Set(manifest.tools.map((t) => t.name));

const configDir = mkdtempSync(path.join(os.tmpdir(), 'nitrosend-mcpb-auth-'));
cleanupDirs.push(configDir);
mkdirSync(configDir, { recursive: true });

const cleanup = () => {
  for (const dir of cleanupDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
};
process.on('exit', cleanup);

const assertNoOrphans = () => {
  // The proxy's argv contains the unpacked entry path (unique per run).
  try {
    const out = execSync(`pgrep -f ${JSON.stringify(baseDir)} || true`, { encoding: 'utf8' }).trim();
    if (out) fail(`orphan process(es) still running after teardown: ${out}`);
  } catch {}
};

const terminate = async (child) => {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(t); resolve(); });
  });
};

// ---------------------------------------------------------------- OAuth probe
if (oauthProbe) {
  const env = { ...process.env, MCP_REMOTE_CONFIG_DIR: configDir };
  delete env.NITROSEND_API_KEY;
  const child = spawn(process.execPath, [entry], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderrBuf = '';
  let stdoutBuf = '';
  child.stdout.on('data', (d) => { stdoutBuf += d; });
  child.stderr.on('data', (d) => { stderrBuf += d; });

  const sawAuthorize = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), TIMEOUT_MS);
    const check = () => {
      if (/api\.nitrosend\.com\/oauth\/authorize/.test(stderrBuf)) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    child.stderr.on('data', check);
    child.once('exit', () => { clearTimeout(timer); resolve(false); });
  });

  if (!sawAuthorize) {
    console.error('--- captured stderr tail ---');
    console.error(stderrBuf.slice(-2000));
    fail('OAuth flow never minted an authorize URL from live discovery');
  }
  ok('OAuth flow minted live authorize URL (api.nitrosend.com/oauth/authorize)');
  for (const line of stdoutBuf.split('\n').filter(Boolean)) {
    try { JSON.parse(line); } catch { fail(`non-JSON stdout during OAuth startup: ${line.slice(0, 120)}`); }
  }
  ok('stdout stayed pure during OAuth startup');
  await terminate(child);
  assertNoOrphans();
  ok('teardown clean, no orphans');
  console.log('OAUTH PROBE PASS');
  process.exit(0);
}

// ------------------------------------------------------------- API-key smoke
const apiKey = (process.env.NITROSEND_API_KEY || '').trim();
if (!apiKey) fail('NITROSEND_API_KEY missing from environment (source ~/.claude/.env)');

const env = {
  ...process.env,
  NITROSEND_API_KEY: apiKey,
  MCP_REMOTE_CONFIG_DIR: configDir,
};
const child = spawn(process.execPath, [entry], { env, stdio: ['pipe', 'pipe', 'pipe'] });

let stdoutBuf = '';
let stderrBuf = '';
const messages = [];
let pendingResolve = null;
child.stdout.on('data', (d) => {
  stdoutBuf += d;
  let idx;
  while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (!line) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      fail(`stdout purity violated — non-JSON line: ${line.slice(0, 160)}`);
    }
    messages.push(parsed);
    if (pendingResolve) pendingResolve();
  }
});
child.stderr.on('data', (d) => { stderrBuf += d; });
child.on('error', (e) => fail(`spawn error: ${e.message}`));

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
const waitFor = (predicate, what) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${what}`)), TIMEOUT_MS);
    const check = () => {
      const found = messages.find(predicate);
      if (found) { clearTimeout(timer); pendingResolve = null; resolve(found); return true; }
      return false;
    };
    if (check()) return;
    pendingResolve = check;
  });

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'nitrosend-mcpb-smoke', version: '1.0.0' },
    },
  });
  const init = await waitFor((m) => m.id === 1, 'initialize response');
  if (!init.result || !init.result.serverInfo) fail(`initialize returned no serverInfo: ${JSON.stringify(init).slice(0, 200)}`);
  ok(`initialize OK (server: ${init.result.serverInfo.name || 'unnamed'}, protocol ${init.result.protocolVersion})`);

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const toolsResp = await waitFor((m) => m.id === 2, 'tools/list response');
  if (!toolsResp.result || !Array.isArray(toolsResp.result.tools)) fail('tools/list returned no tools array');
  const liveTools = new Set(toolsResp.result.tools.map((t) => t.name));
  ok(`tools/list OK (${liveTools.size} tools visible to this credential)`);

  // Manifest baseline must be exactly the live set minus gated tools; no gated
  // name may appear in the manifest. Set comparison — never a count.
  const gatedInManifest = [...manifestTools].filter((n) => GATED_TOOLS.has(n));
  if (gatedInManifest.length) fail(`gated tools present in manifest: ${gatedInManifest.join(', ')}`);
  const expected = new Set([...liveTools].filter((n) => !GATED_TOOLS.has(n)));
  const missing = [...expected].filter((n) => !manifestTools.has(n));
  const stale = [...manifestTools].filter((n) => !expected.has(n));
  if (missing.length || stale.length) {
    fail(`manifest/live tool set mismatch — missing from manifest: [${missing.join(', ')}], stale in manifest: [${stale.join(', ')}]`);
  }
  ok('manifest tool set == live public baseline (live minus gated trio)');

  const annotated = toolsResp.result.tools.filter((t) => t.annotations && t.annotations.title !== undefined && t.annotations.readOnlyHint !== undefined);
  ok(`${annotated.length}/${liveTools.size} live tools carry title + readOnlyHint annotations`);

  // Secret hygiene: the key must not be visible in any live process argv...
  const psOut = execSync('ps -axo command', { encoding: 'utf8' });
  if (psOut.includes(apiKey)) fail('API key visible in a process argv');
  ok('API key absent from all process argv (ps scan)');
  // ...nor in anything the pipeline printed.
  if (stdoutBuf.includes(apiKey) || stderrBuf.includes(apiKey) || messages.some((m) => JSON.stringify(m).includes(apiKey))) {
    fail('API key leaked into captured output');
  }
  ok('API key absent from captured stdout/stderr');

  // Teardown: closing stdin is the client hanging up; the pipeline must exit.
  child.stdin.end();
  const exited = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 15_000);
    child.once('exit', () => { clearTimeout(t); resolve(true); });
  });
  if (!exited) {
    await terminate(child);
    fail('proxy did not exit on stdin EOF');
  }
  ok('proxy exited on stdin EOF');
  assertNoOrphans();
  ok('no orphan processes');

  console.log('SMOKE PASS');
  process.exit(0);
} catch (err) {
  console.error('--- captured stderr tail ---');
  console.error(stderrBuf.slice(-2000));
  await terminate(child);
  fail(err.message);
}
