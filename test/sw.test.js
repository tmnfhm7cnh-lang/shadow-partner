import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('the offline cache lists every file the app loads', () => {
  const listed = new Set([...swSource.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const needed = [
    'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png',
    ...walk(path.join(root, 'src')).map((p) => path.relative(root, p).split(path.sep).join('/')),
  ];
  for (const f of needed) assert.ok(listed.has(f), `sw.js does not cache ${f}`);
  for (const f of listed) if (f) assert.ok(fs.existsSync(path.join(root, f)), `sw.js caches a missing file: ${f}`);
});

test('activating only deletes this app\'s old caches, never a sibling app\'s on the same origin', async () => {
  const handlers = {};
  const deleted = [];
  let existing = [];
  const ctx = vm.createContext({
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, clients: { claim: async () => {} } },
    caches: {
      keys: async () => existing,
      delete: async (k) => { deleted.push(k); return true; },
    },
  });
  vm.runInContext(swSource, ctx);
  const current = vm.runInContext('CACHE', ctx);
  existing = ['angle-lab-v16', 'dryland-test-logger-v9', 'shadow-partner-v0', current];
  let done;
  handlers.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(deleted, ['shadow-partner-v0']);
});
