// Archive verification for the packed .mcpb (dev-only; excluded from the pack).
//
// Usage: node scripts/verify.mjs dist/nitrosend.mcpb
//
// Asserts required entries are present, excluded entries are absent, the
// archive is under the size budget, no secrets/credentials/local paths leaked
// into any entry, dependency licenses ship, and prints the SHA-256.

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const MAX_BYTES = 25 * 1024 * 1024;

// Patterns that must not appear anywhere in the archive. Strings are assembled
// from fragments so this script does not itself trip the scan when packed by
// mistake. Docs may mention the `nskey_...` key FORMAT; only real key material
// (prefix + long random suffix) is forbidden, hence the regex.
const FORBIDDEN = [
  /nskey_(live|test)_[A-Za-z0-9]{8,}/, // actual Nitrosend API key material
  'BEGIN ' + 'RSA PRIVATE KEY',
  'BEGIN ' + 'PRIVATE KEY',
  'BEGIN ' + 'OPENSSH PRIVATE KEY',
  'testinganthropic' + 'nitrosend',    // directory review account email
  'repksork',                          // directory review account password
  '/Users/' + 'georgehartley',         // local home paths
];

const artifact = process.argv[2];
if (!artifact) {
  console.error('usage: node scripts/verify.mjs <path-to.mcpb>');
  process.exit(2);
}

const fail = (msg) => {
  console.error(`verify FAIL: ${msg}`);
  process.exit(1);
};

const size = statSync(artifact).size;
if (size >= MAX_BYTES) fail(`archive is ${size} bytes (budget ${MAX_BYTES})`);

const names = execFileSync('zipinfo', ['-1', artifact], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const required = [
  'manifest.json',
  'server/index.js',
  'LICENSE',
  'README.md',
  'icon.png',
  'node_modules/mcp-remote/dist/proxy.js',
  'node_modules/mcp-remote/LICENSE',
  'node_modules/mcp-remote/package.json',
];
for (const entry of required) {
  if (!names.includes(entry)) fail(`missing required entry: ${entry}`);
}

const banned = names.filter(
  (n) =>
    n.startsWith('test/') ||
    n.startsWith('scripts/') ||
    n.startsWith('dist/') ||
    n.startsWith('.git') ||
    n.includes('/.git/') ||
    /(^|\/)\.env($|\.)/.test(n) ||
    n.endsWith('.log') ||
    n.endsWith('.DS_Store') ||
    n.endsWith('.mcpb') ||
    // dependency dev/test junk must not ship either — directory-shaped...
    /(^|\/)(test|tests|__tests__|example|examples)\//.test(n) ||
    /(^|\/)\.github\//.test(n) ||
    /^node_modules\/.*\/(docs|scripts)\//.test(n) ||
    // ...and file-shaped (test entries, CI metadata, dotfile configs)
    /(^|\/)(test[^/]*|tests[^/]*)\.(js|mjs|cjs|ts|md)$/.test(n) ||
    /(^|\/)src\/test\.(js|mjs|cjs|ts)$/.test(n) ||
    /(^|\/)(\.travis\.yml|\.coveralls\.yml|\.npmignore|karma\.conf\.js|Makefile|\.editorconfig)$/.test(n) ||
    /(^|\/)\.eslintrc[^/]*$/.test(n) ||
    /(^|\/)\.nycrc[^/]*$/.test(n)
);
if (banned.length) fail(`excluded entries leaked into archive: ${banned.join(', ')}`);

// Scan every entry's bytes for forbidden strings.
for (const name of names) {
  if (name.endsWith('/')) continue;
  let content;
  try {
    content = execFileSync('unzip', ['-p', artifact, name], {
      encoding: 'latin1',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(`could not read entry: ${name}`);
  }
  for (const needle of FORBIDDEN) {
    const hit = needle instanceof RegExp ? needle.test(content) : content.includes(needle);
    if (hit) fail(`forbidden content ${needle} found in ${name}`);
  }
}

const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
console.log(`verify OK: ${names.length} entries, ${size} bytes`);
console.log(`sha256: ${sha256}`);
