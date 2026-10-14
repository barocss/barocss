import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// One actual public request per fresh process. Run only with a frozen entry and
// a new output directory; preserve raw results before any correctness oracle.
const [entryArgument, outputArgument] = process.argv.slice(2);
assert.ok(entryArgument && outputArgument, 'Usage: node endpoint-crossing-native.mjs ENTRY OUTPUT');
const entry = resolve(entryArgument), output = resolve(outputArgument);
mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize > 500 * 1024 * 1024);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const curve = {kind:'curve',id:'accuracy_c1_curve',degree:2,knots:[0,0,0,1,1,1],
  controlPoints:[[.25,.5,260],[.5,.5,3.43e-5],[.75,.5,-4.2e-14]],weights:[1e6,1e6,1e6]};
const plane = {kind:'surface',id:'accuracy_c1_plane',degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],
  controlPoints:[[[0,0,0],[0,1,0]],[[1,0,0],[1,1,0]]],weights:[[1,1],[1,1]]};
const options = {evaluationId:'accuracy_c1_model',pointEventIds:['accuracy_c1_crossing']};
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value,null,2)+'\n',{flag:'wx'});
save('request.json', {curve,plane,options});
save('entry.json', {entry,sha256:hash(readFileSync(entry)),actualPublicRequests:1});
const {intersectBezierCurveWithAffinePlaneSurface} = await import(pathToFileURL(entry).href);
let result;
try { result = intersectBezierCurveWithAffinePlaneSurface(curve,plane,options); }
catch (error) {save('error.json',{name:error.name,message:error.message,stack:error.stack});throw error;}
save('result.json',result);
assert.equal(result.kind,'isolated'); assert.equal(result.events.length,1);
assert.deepEqual(result.curve,curve); assert.deepEqual(result.plane,plane); assert.deepEqual(result.options,options);
assert.deepEqual(result.model,{name:options.evaluationId,version:0,lengthUnit:'mm',objects:[curve,plane]});
assert.equal(result.sourceVersion,0); assert.ok(result.source.includes('@curve #accuracy_c1_curve'));
assert.deepEqual(result.report.equation.bernstein,[260000000,34.3,-4.2e-8]);
const event = result.events[0], [low,high] = event.bracket;
assert.equal(event.kind,'crossing'); assert.equal(event.rootTouch,false);
assert.ok(0<low && low<event.parameter && event.parameter<high && high<1);
assert.ok(high-low<=1e-12); assert.equal(event.parameter,.9999999993892743);
assert.deepEqual(event.normalizedBracket,event.bracket);
assert.equal(event.finiteDomainAdmitted,true); assert.equal(event.classification,'finite-domain-admitted');
assert.ok(Number.isFinite(event.residualMM) && event.residualMM<=1e-7);
assert.ok(event.pointMM.every(Number.isFinite) && event.planeUV.every(Number.isFinite));
assert.equal(event.planeUV[2],0); assert.ok(event.planeUV.slice(0,2).every(v=>v>=0&&v<=1));
assert.ok(event.planePointMM.every(Number.isFinite));
assert.equal(event.sideObservations.length,3);
assert.ok(event.sideObservations[0].signedDistanceMM>0 && event.sideObservations[2].signedDistanceMM<0);
assert.equal(event.curveD1.status,'evaluated');
assert.equal(event.semantics,'original-curve-point-at-numerical-root-not-projected-or-sewn');
assert.equal(result.report.geometricValidity,'not-certified'); assert.equal(result.report.topologyCertified,false);
assert.equal(result.report.solid,false);
assert.deepEqual(result.report.numericPolicy,{parameterWidthTarget:1e-12,normalizedParameterWidthTarget:1e-12,
  maximumRootSteps:64,pointBindingComparisonMM:1e-7,uvBoundaryPolicy:'original-estimate-and-bracket-domain-agreement-no-clamp',
  gramPolicy:'64-epsilon-scaled-determinant-refusal',exactParameterDedupOnly:true});
const recovery=result.report.equation.endpointCrossingRecovery;
assert.equal(recovery.policy,'exact-stored-binary64-Bernstein-sign-isolation');
assert.deepEqual(recovery.bracket,event.bracket); assert.equal(recovery.iterations,40);
save('receipt.json',{status:'passed',actualPublicRequests:1,parameter:event.parameter,bracket:event.bracket,
  residualMM:event.residualMM,curveD1Status:event.curveD1.status,originalSourceRetained:true,
  geometricValidity:result.report.geometricValidity,topologyCertified:false,solid:false,
  resultSHA256:hash(readFileSync(resolve(output,'result.json')))});
console.log('PASS one actual original Curve-plane crossing; source/domain/UV/D1/policy retained');
