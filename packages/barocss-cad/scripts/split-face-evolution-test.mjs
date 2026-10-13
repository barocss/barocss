import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Contract-only checks. Native Split correctness is still owned by its
// existing source/emitted/cold fixtures; this test cannot certify geometry.
const dir = mkdtempSync(join(tmpdir(), 'cad-split-lineage-'));
try {
  const output = await build({
    entryPoints: [resolve('packages/barocss-cad/src/split-face-evolution.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'es2022',
    write: false,
  });
  const file = join(dir, 'projection.mjs');
  writeFileSync(file, output.outputFiles[0].text);
  const { projectConvexPlanarSplitFaceEvolution: project } = await import(pathToFileURL(file));
  const parent = {sourceId:'original',faceId:'top',surfaceId:'surface',loopId:'loop'};
  const make = (side,role,output) => ({
    side,role,key:side+'-'+role,parent,output,edges:[]
  });
  const split = {
    report:{schema:'barocss-convex-planar-solid-split',operationId:'op',status:'split'},
    lineage:{faces:[
      make('negative','clipped',{sourceId:'left',faceId:'leftTop',surfaceId:'leftS',loopId:'leftL'}),
      make('positive','clipped',{sourceId:'right',faceId:'rightTop',surfaceId:'rightS',loopId:'rightL'}),
      {side:'negative',role:'cap',key:'cap',parent:null,
       output:{sourceId:'left',faceId:'cap',surfaceId:'capS',loopId:'capL'},edges:[]}
    ]}
  };
  const result = project(split);
  assert.equal(result.namingCertified,false);
  assert.equal(result.faces.length,1);
  assert.equal(result.faces[0].resolution,'ambiguous');
  assert.equal(result.faces[0].outcomes.length,2);
  assert.equal(result.generatedCaps.length,1);
  const retained = structuredClone(split);
  retained.lineage.faces = [make('negative','retained',{sourceId:'left',faceId:'top',surfaceId:'surface',loopId:'loop'})];
  assert.equal(project(retained).faces[0].resolution,'unique');
  const deleted = structuredClone(split);
  deleted.lineage.faces = [make('negative','deleted',null)];
  assert.equal(project(deleted).faces[0].resolution,'deleted');
  const malformed = structuredClone(split);
  malformed.lineage.faces[0].output = null;
  assert.throws(() => project(malformed),/Invalid native deletion\/output lineage/);
  console.log('PASS: bounded Split lineage projection contract controls');
} finally {
  rmSync(dir,{recursive:true,force:true});
}
