import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('the offline cache lists every file the app loads', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const needed = [
    'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
    ...walk(path.join(root, 'src')).map((p) => path.relative(root, p).split(path.sep).join('/')),
  ];
  for (const f of needed) assert.ok(listed.has(f), `sw.js does not cache ${f}`);
  for (const f of listed) if (f) assert.ok(fs.existsSync(path.join(root, f)), `sw.js caches a missing file: ${f}`);
});
