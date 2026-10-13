import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Contract-level regression only. The native Split provider's actual geometry
// and provenance are verified by its separate native fixtures.
const dir = mkdtempSync(join(tmpdir(), 'barocss-face-ref-'));
try {
  const bundle = await build({
    entryPoints: [resolve('packages/barocss-cad/src/persistent-face-reference-v1.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false,
  });
  const filename = join(dir, 'face-ref.mjs');
  writeFileSync(filename, bundle.outputFiles[0].text);
  const { resolveAuthoredFaceAfterSplitV1: resolveRef } = await import(pathToFileURL(filename));
  const target = { sourceId:'source', faceId:'face', surfaceId:'surface', loopId:'loop' };
  const ref = { version:1, featureId:'feature', outputRole:'top', target };
  const face = (id) => ({ sourceId:'result', faceId:id, surfaceId:'surface'+id, loopId:'loop'+id });
  const receipt = (outcomes) => ({
    schema:'barocss-cad-split-face-evolution', version:0, namingCertified:false,
    faces:[{ parent:target, outcomes }],
  });
  const survivor = (side,id) => ({ side, role:'clipped', output:face(id) });
  const unique = resolveRef(ref,receipt([survivor('negative','a')]));
  assert.deepEqual(unique,{status:'resolved',side:'negative',target:face('a')});
  const ambiguous = resolveRef(ref,receipt([survivor('negative','a'),survivor('positive','b')]));
  assert.equal(ambiguous.status,'ambiguous');
  assert.deepEqual(ambiguous.candidates,[face('a'),face('b')]);
  assert.deepEqual(resolveRef(ref,receipt([{side:'negative',role:'deleted',output:null}])),
    {status:'missing',reason:'deleted'});
  assert.deepEqual(resolveRef(ref,receipt([])),{status:'missing',reason:'deleted'});
  assert.deepEqual(resolveRef(ref,{...receipt([]),faces:[]}),{status:'missing',reason:'no-lineage'});
  assert.equal(resolveRef({...ref,featureId:''},receipt([])).status,'unsupported');
  assert.equal(resolveRef(ref,{...receipt([]),namingCertified:true}).status,'unsupported');
  assert.equal(resolveRef(ref,receipt([{side:'other',role:'retained',output:face('a')}])).status,'unsupported');
  console.log('PASS: scoped authored Face reference resolution controls');
} finally {
  rmSync(dir,{recursive:true,force:true});
}
