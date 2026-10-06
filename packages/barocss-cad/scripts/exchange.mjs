import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, evaluateCurve, evaluateSurface, curveDomain, surfaceDomain, exportIGES } from '../dist/index.js';
const root = resolve(import.meta.dirname,'../../..');
const output = resolve(process.env.BAROCSS_CAD_EVIDENCE ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence');
const python = process.env.BAROCSS_CAD_PYTHON;
assert.ok(python,'BAROCSS_CAD_PYTHON must name the isolated consumer interpreter');
mkdirSync(output,{recursive:true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures=[];
for (const name of ['quarter-circle','quarter-cylinder','asymmetric-patch']) {
  const source=readFileSync(resolve(root,`examples/cad-nurbs/${name}.css`),'utf8');
  const compilation=compileCadModel(source,{sourceVersion:0});assert.equal(compilation.ok,true,JSON.stringify(compilation.diagnostics));const model=compilation.model;const object=model.objects[0];
  const exported=exportIGES(model,[object.id]); const samples=[];
  const domain=object.kind==='curve'?curveDomain(object):surfaceDomain(object);
  if(object.kind==='curve') {
    for(let i=0;i<17;i++) {const u=domain[0]+(domain[1]-domain[0])*i/16; samples.push({u,point:evaluateCurve(object,u)});}
  } else {
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) {const u=domain.u[0]+(domain.u[1]-domain.u[0])*i/8;const v=domain.v[0]+(domain.v[1]-domain.v[0])*j/8;samples.push({u,v,point:evaluateSurface(object,u,v)});}
  }
  const entry={name,kind:object.kind,entity:object.kind==='curve'?126:128,domain,samples,sourceHash:hash(source),igesHash:hash(exported.iges),exportReport:exported.report};
  writeFileSync(resolve(output,`${name}.css`),source);writeFileSync(resolve(output,`${name}.iges`),exported.iges);
  writeFileSync(resolve(output,`${name}.native.json`),JSON.stringify(model,null,2)+'\n');fixtures.push(entry);
}
const manifest={evaluator:'@barocss/cad 0.0.0-private-experimental',base:'0c1d3c828e2e58e3b6035a85b107b94bef0e34a0',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fixtures};
writeFileSync(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const adapter=resolve(import.meta.dirname,'read-ocp.py');
const run=spawnSync(python,[adapter,output],{encoding:'utf8'});
writeFileSync(resolve(output,'reader.stdout.txt'),run.stdout ?? '');writeFileSync(resolve(output,'reader.stderr.txt'),run.stderr ?? '');
if(run.status!==0) throw new Error(`OCP read-back failed (${run.status}): ${run.stderr}\n${run.stdout}`);
const original=readFileSync(resolve(output,'quarter-circle.iges'),'utf8');
// Deliberately break the first entity's Parameter Data pointer; the independent adapter must fail.
const records=original.trimEnd().split('\n');const d=records.findIndex(line=>line[72]==='D');
records[d]=records[d].slice(0,8)+'  999999'+records[d].slice(16);
writeFileSync(resolve(output,'corrupted.iges'),records.join('\n')+'\n');
const negative=spawnSync(python,[adapter,output,'--corrupt'],{encoding:'utf8'});
writeFileSync(resolve(output,'corrupted-reader.txt'),`${negative.stdout}\n${negative.stderr}`);
assert.notEqual(negative.status,0,'Corrupt IGES unexpectedly passed independent read-back');
// Corrupt a real pole while retaining valid structure. OCCT must read these bytes,
// and its geometry must fail the analytic comparison (not merely a checksum).
const dataRecords=original.trimEnd().split('\n');
const firstP=dataRecords.findIndex(line=>line[72]==='P' && line.slice(0,64).includes('10.0'));
assert.ok(dataRecords[firstP].includes('10.0'), 'Expected pole token missing');
dataRecords[firstP]=dataRecords[firstP].replace('10.0','11.0');
writeFileSync(resolve(output,'corrupted.iges'),dataRecords.join('\n')+'\n');
const badGeometry=spawnSync(python,[adapter,output,'--corrupt'],{encoding:'utf8'});
writeFileSync(resolve(output,'corrupted-geometry-reader.txt'),`${badGeometry.stdout}\n${badGeometry.stderr}`);
assert.notEqual(badGeometry.status,0,'Corrupt geometry unexpectedly passed OCCT comparison');
const report=JSON.parse(readFileSync(resolve(output,'readback.json')));
const digestReport={...report,negativeControl:{pointerStatus:negative.status,geometryStatus:badGeometry.status,passed:true},manifestHash:hash(readFileSync(resolve(output,'manifest.json')))};
writeFileSync(resolve(output,'report.json'),JSON.stringify(digestReport,null,2)+'\n');
writeFileSync(resolve(output,'report.sha256'),hash(readFileSync(resolve(output,'report.json')))+'\n');
console.log(JSON.stringify(digestReport,null,2));

// Preserve the current source read-back and add the actual extracted construction path.
const { runConstructionExchange } = await import('./construction-exchange.mjs');
runConstructionExchange();
const { runDerivativeExchange } = await import('./derivative-exchange.mjs');
runDerivativeExchange();
const { runBoundaryExchange } = await import('./boundary-exchange.mjs');
runBoundaryExchange();
const { runFaceExchange } = await import('./face-exchange.mjs');
runFaceExchange();
const { runAdjacencyExchange } = await import('./adjacency-exchange.mjs');
runAdjacencyExchange();
const { runOrthogonalExchange } = await import('./orthogonal-exchange.mjs');
runOrthogonalExchange();
const { runBoxShellExchange } = await import('./box-shell-exchange.mjs');
runBoxShellExchange();

const { runBoxSolidExchange } = await import('./box-solid-exchange.mjs');
runBoxSolidExchange();

const { runParameterExchange } = await import('./parameter-exchange.mjs');
runParameterExchange();

const { runXYProfileExchange } = await import('./profile-exchange.mjs');
runXYProfileExchange();

const { runXYArcExchange } = await import('./arc-exchange.mjs');
runXYArcExchange();

const { runRectangleExtrusionExchange } = await import('./rectangle-extrusion-exchange.mjs');
runRectangleExtrusionExchange();

const { runRectangleFeatureExchange } = await import('./rectangle-feature-exchange.mjs');
runRectangleFeatureExchange();
