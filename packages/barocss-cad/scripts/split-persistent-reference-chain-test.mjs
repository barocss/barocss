import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Contract integration: actual native Split geometry/certification is covered
// by convex-planar-solid-split-demo.mjs, not by this synthetic lineage test.
const dir = mkdtempSync(join(tmpdir(), 'barocss-lineage-chain-'));
try {
  const bundled = await build({
    entryPoints: [
      resolve('packages/barocss-cad/src/split-face-evolution.ts'),
      resolve('packages/barocss-cad/src/exact-proof/persistent-face-reference-v1.ts'),
    ],
    bundle:true, platform:'node', format:'esm', target:'es2022',
    outdir:dir, outExtension:{'.js':'.mjs'}, write:true,
  });
  assert.ok(bundled.errors.length===0);
  const { projectConvexPlanarSplitFaceEvolution:project } =
    await import(pathToFileURL(join(dir,'split-face-evolution.mjs')));
  const { resolveAuthoredFaceAfterSplitV1:resolveRef } =
    await import(pathToFileURL(join(dir,'exact-proof','persistent-face-reference-v1.mjs')));
  const original = {sourceId:'source',faceId:'top',surfaceId:'plane',loopId:'outer'};
  const output = (side) => ({sourceId:side,faceId:side+'Top',surfaceId:side+'Plane',loopId:side+'Loop'});
  const entry = (side,role,result) => ({side,role,key:side+role,parent:original,output:result,edges:[]});
  const split = (entries) => ({
    report:{schema:'barocss-convex-planar-solid-split',operationId:'splitOp',status:'split'},
    lineage:{faces:entries},
  });
  const authored = {version:1,featureId:'extrude',outputRole:'top',target:original};
  const both = project(split([
    entry('negative','clipped',output('negative')),
    entry('positive','clipped',output('positive'))
  ]));
  assert.equal(both.faces[0].resolution,'ambiguous');
  const uncertain = resolveRef(authored,both);
  assert.equal(uncertain.status,'ambiguous');
  assert.deepEqual(uncertain.candidates,[output('negative'),output('positive')]);
  const sole = project(split([entry('negative','retained',output('negative'))]));
  assert.deepEqual(resolveRef(authored,sole),{status:'resolved',side:'negative',target:output('negative')});
  const gone = project(split([entry('negative','deleted',null)]));
  assert.deepEqual(resolveRef(authored,gone),{status:'missing',reason:'deleted'});
  assert.deepEqual(authored.target,original,'read-only resolution must not change authored reference');
  console.log('PASS: projected Split lineage -> authored Face resolution (contract only)');
} finally { rmSync(dir,{recursive:true,force:true}); }
