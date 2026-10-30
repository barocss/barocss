// D325 observational API delta collection. Generated output still requires human review.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const repo = process.cwd(), output = resolve(repo, 'apps/cad-studio/handover/notes/viewer-clipping-contract-2026-10-29/api-review');
const { collectApiInventory, writeExpected } = await import(pathToFileURL(resolve(repo, 'apps/library-docs/scripts/api-inventory.mjs')));
const { checkInventory } = await import(pathToFileURL(resolve(repo, 'apps/library-docs/scripts/api-inventory-policy.mjs')));
const ts = createRequire(resolve(repo, 'package.json'))('typescript');
const expectedFile = resolve(repo, 'apps/library-docs/scripts/api-inventory.expected.json'), beforeBytes = readFileSync(expectedFile), before = JSON.parse(beforeBytes);
const collection = collectApiInventory({ repo, ts }), check = checkInventory(collection, before);
writeFileSync(resolve(output, 'before-check.json'), JSON.stringify(check, null, 2) + '\n');
const generation = writeExpected(collection, resolve(output, 'candidate.json'));
const changes = [];
function compare(a, b, location) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (Array.isArray(a) && Array.isArray(b) && location.endsWith('/members')) {
    const am = new Map(a.map(item => [item.name, item])), bm = new Map(b.map(item => [item.name, item]));
    for (const name of new Set([...am.keys(), ...bm.keys()])) compare(am.get(name), bm.get(name), location + '/' + name);
  } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) compare(a[i], b[i], location + '/' + i);
  } else if (a && b && !Array.isArray(a) && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[key], b[key], location + '/' + key);
  } else changes.push({ path: location, before: a ?? null, after: b ?? null });
}
compare(before, collection.data, '');
const review = { baseline: 'd85558ce0031d812341d5871743f8535520eb8d4', beforeSHA256: createHash('sha256').update(beforeBytes).digest('hex'), issues: collection.issues, originalCheck: check.status, generation, changes };
writeFileSync(resolve(output, 'reviewed-delta.json'), JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify(review, null, 2));
if (generation.status !== 'GENERATED_FOR_REVIEW') process.exitCode = 1;
