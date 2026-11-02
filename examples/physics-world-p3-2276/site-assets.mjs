// DATA-only source, public-copy and built-copy equality for the new P3 records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const docs = join(root, 'apps/library-docs/docs');
const pairs = [
  ['README.md', 'p3-report.txt'],
  ['evidence/main-data-audit-01/summary.json', 'p3-main.json'],
  ['evidence/controls-01/summary.json', 'p3-controls.json'],
  ['evidence/recorder-01/summary.json', 'p3-recorder.json'],
  ['evidence/adoption-01/summary.json', 'p3-adoption.json'],
];
const results = pairs.map(([source, asset]) => {
  const bytes = readFileSync(join(here, source));
  assert.ok(bytes.equals(readFileSync(join(docs, 'public/physics-evidence', asset))), asset + ': source copy differs');
  assert.ok(bytes.equals(readFileSync(join(docs, '.vitepress/dist/physics-evidence', asset))), asset + ': built copy differs');
  return { asset, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
console.log(JSON.stringify({ status: 'PASS', records: results, WorldCalls: 0, referenceCalls: 0, networkCalls: 0 }));
