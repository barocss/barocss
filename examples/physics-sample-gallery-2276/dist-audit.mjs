// Data-only bridge from the paid canonical copy to the reusable package dist.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '../..'), id = process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id ?? '') && process.argv.length === 3);
const out = join(import.meta.dirname, 'evidence', id);
mkdirSync(dirname(out), { recursive: true }); mkdirSync(out);
const path = join(root, 'examples/physics-anisotropic-inertia-2276/evidence/public-build-03/result.json');
const build = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(build.sourceIntegrity, true); assert.equal(build.firstFailure, null);
const source = dirname(build.nativeEntry), target = join(root, 'packages/barocss-physics/dist');
const pin = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const compared = [];
function walk(at) {
  for (const entry of readdirSync(at, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink());
    const p = join(at, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(?:js|mjs)$/.test(entry.name)) {
      const sha = pin(p), other = join(target, relative(source, p));
      assert.equal(sha, build.nativePins[relative(root, p)], 'paid module pin');
      assert.equal(pin(other), sha, 'reusable package runtime equals canonical module');
      compared.push({ canonical: relative(root, p), actual: relative(root, other), sha256: sha });
    }
  }
}
walk(source); assert.equal(compared.length, 121);
const result = { status: 'GALLERY_PACKAGE_DIST_RUNTIME_BYTES_CONFIRMED', buildManifest: path,
  buildManifestSHA256: pin(path), runtimeFiles: compared, worldCalls: 0,
  referenceCalls: 0, compilerCalls: 0, browserCalls: 0, publication: false };
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, identicalRuntimeFiles: compared.length, worldCalls: 0 }));
