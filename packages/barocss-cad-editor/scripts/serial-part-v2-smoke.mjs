// One bounded real public-engine consumer flow. No GPU or native OS file claims.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-editor-prism-native'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ stdin: { contents: `export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-engine.ts')}'; export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts') } });
assert.ok(Object.keys(bundle.metafile.inputs).every(path => !path.includes('/dist/')));
writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
writeFileSync(resolve(output, 'inputs.json'), JSON.stringify(bundle.metafile, null, 2));
const { createPrismFeatureEngine, preparePrismFeatureScene } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
const profiler = new Session(); profiler.connect();
const post = method => new Promise((resolve, reject) => profiler.post(method, (error, value) => error ? reject(error) : resolve(value)));
await post('Profiler.enable');
await new Promise((resolve, reject) => profiler.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true }, error => error ? reject(error) : resolve()));
async function flow() {
const engine = createPrismFeatureEngine(), fixture = readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/serial-part-v2.authored.json'), 'utf8');
const observed=[];
const signedJSON = value => JSON.stringify(value, (_key, v) => Object.is(v, -0) ? '__serial_negative_zero__' : v).replaceAll('"__serial_negative_zero__"', '-0');
const success = reply => { observed.push(reply); writeFileSync(resolve(output,'observed-replies.json'),signedJSON(observed)); assert.equal(reply.ok, true, reply.message); return reply; };
const number = f => Number(f.numerator) / Number(f.denominator);
const volume = r => number(r.summary.serial.volumes.negative);
let id=0;
const start=success(engine({id:++id,kind:'open',version:2,text:fixture}));
const edit=(previous,parameterId,valueMM)=>success(engine({id:++id,kind:'apply',expectedRevision:previous.summary.document.revision,edits:[{parameterId,valueMM}]}));
const height=edit(start,'parentHeight',6);
const distance=edit(height,'setback',2);
const undone=edit(distance,'setback',1);
const redone=edit(undone,'setback',2);
const cold=success(createPrismFeatureEngine()({id:++id,kind:'open',version:2,text:redone.text}));
const fraction=n=>({numerator:String(n),denominator:'1'});
for(const [r,finished,removed] of [[start,3064,8],[height,2296,8],[distance,2272,32],[undone,2296,8],[redone,2272,32],[cold,2272,32]]) {
 assert.deepEqual(r.summary.serial.volumes.negative,fraction(finished));
 assert.deepEqual(r.summary.serial.volumes.positive,fraction(removed));
 assert.deepEqual(r.summary.serial.volumes.parent,fraction(finished+removed));
 assert.deepEqual(r.summary.volumes.first,fraction(r===start?2048:1536));
}
const first=r=>r.display.components.find(c=>c.role==='first');
for(const r of [distance,undone,redone,cold]) assert.deepEqual(first(r),first(height));
assert.deepEqual(cold, {...redone,id:cold.id});
const refused=engine({id:++id,kind:'apply',expectedRevision:redone.summary.document.revision,edits:[{parameterId:'rearX',valueMM:20},{parameterId:'upperX',valueMM:24}]});
assert.equal(refused.ok,false); assert.match(refused.message,/represent|coordinate|BINARY|native/i);
assert.equal(engine({id:++id,kind:'open',version:0,text:redone.text}).ok,false);
assert.equal(engine({id:++id,kind:'apply',expectedRevision:-1,edits:[]}).ok,false);
// The failed requests leave the actual worker authority at the accepted v2 revision.
const noop=success(engine({id:++id,kind:'apply',expectedRevision:redone.summary.document.revision,edits:[]}));
assert.equal(volume(noop),2272);
const replies=[start,height,distance,undone,redone,cold,noop];
for(const reply of replies){
 const {serial,document}=reply.summary, final=reply.display.components.find(c=>c.role==='second');
 assert.equal(serial.parentSolidId,document.nodes[4].second.solidId);
 assert.equal(serial.finalSolidId,document.nodes[5].options.retainedSolidId);
 assert.notEqual(serial.finalSolidId,serial.parentSolidId);
 assert.equal(final.report.solidId,serial.finalSolidId);
 assert.deepEqual(final.lineage.resolution,serial.resolution);
 assert.equal(final.lineage.chamfer.parentEdgeId,serial.resolution.componentEdgeId);
 assert.equal(final.lineage.split.faces.filter(f=>f.side==='negative' && f.output).length,final.mesh.faces.length);
 assert.equal(preparePrismFeatureScene(reply.display,'source').scene.geometries.length,1);
 assert.equal(preparePrismFeatureScene(reply.display,'result').scene.geometries.length,2);
 assert.ok(!reply.text.includes('certificate') && !reply.text.includes('chamferResolution'));
}
writeFileSync(resolve(output,'replies.json'),signedJSON(replies));
writeFileSync(resolve(output,'authored.json'),redone.text);
return { replies, redone };
}
let completed;
try { completed=await flow(); }
catch(error) {
 const coverage=await post('Profiler.takePreciseCoverage');
 writeFileSync(resolve(output,'first-failure-coverage.json'),JSON.stringify(coverage));
 writeFileSync(resolve(output,'first-failure.txt'),error.stack??String(error));
 await post('Profiler.stopPreciseCoverage');profiler.disconnect();throw error;
}
const {replies,redone}=completed;
const volume=r=>Number(r.summary.serial.volumes.negative.numerator)/Number(r.summary.serial.volumes.negative.denominator);
const coverage=await post('Profiler.takePreciseCoverage');await post('Profiler.stopPreciseCoverage');profiler.disconnect();
const names=['tessellateConvexPlanarSolid','parseXYAffinePrismFeatureDocumentV2','updateXYAffinePrismFeatureDocumentV2','serializeXYAffinePrismFeatureDocumentV2','compileCadModel','buildConvexPlanarFace','evaluateCurveD1','evaluateSurfaceD1'];
const counts=Object.fromEntries(names.map(name=>[name,coverage.result.flatMap(script=>script.functions.filter(f=>f.functionName===name)).reduce((n,f)=>n+f.ranges[0].count,0)]));
// 2 opens×2 phases + 4 edits×3 phases + refused update×2 phases + no-op validation/serialization×2 + stale prior validation×1 =21 cold-equivalent phases.
// 7 complete successful packets require21 mesh parent validations. No-op still validates and re-emits accepted geometry.
assert.equal(counts.tessellateConvexPlanarSolid,21);
assert.ok(counts.compileCadModel<=21*204+21*12);
assert.ok(counts.buildConvexPlanarFace<=21*197+21*12);
assert.ok(counts.evaluateCurveD1+counts.evaluateSurfaceD1<=21*8910+21*576);
const result={ok:true,volumes:replies.map(volume),counts,coldEquivalentPhases:21,meshParentValidations:21,
 sourceHash:createHash('sha256').update(bundle.outputFiles[0].text).digest('hex'),authoredHash:createHash('sha256').update(redone.text).digest('hex'),
 evidence:'real public v2 native-to-CPU mesh flow; history-equivalent parameter updates, not browser UI; no GPU or OS file acceptance'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
