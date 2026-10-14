import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// ZERO-NATIVE leaf controls. Synthetic data below is deliberately NOT a
// qualified Solid, native Face, native translation or geometric lineage proof.
// All validator, Face builder and Solid qualifier bindings are replaced.
// The actual occurrence ledger, comparison/error helpers and rational context
// remain in the bundle. Default execution checks source AND checked emit.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const { build } = require('esbuild');
const entries = process.env.CAD_MODEL_ROTATION_PIVOT_INTERNAL_ENTRY
  ? [resolve(process.env.CAD_MODEL_ROTATION_PIVOT_INTERNAL_ENTRY)]
  : ['../src/modeling-rotation-internal.ts', '../dist/modeling-rotation-internal.js'].map(path => fileURLToPath(new URL(path, import.meta.url)));
const allowed = new Set(['modeling-rotation-internal', 'convex-planar-solid-proof-internal', 'section-rational-internal']);
const providers = new Map([['convex-planar-solid', ['validateConvexPlanarSolid', 'qualifyConvexPlanarSolid']], ['own-convex-planar-face', ['buildConvexPlanarFace']]]);
const marker = 'INERT_PIVOT_LEAF_CONTROL_NOT_GEOMETRY';
const clone = value => structuredClone(value);
const keys = [];

// This single synthetic triangle is NOT closed and has no authentic certificate.
// Traps supply topology and rational support data solely for leaf invariants.
const gcd=(a,b)=>b===0n?a:gcd(b,a%b);
function frac(value){
 if(value===0)return {numerator:'0',denominator:'1'};
 const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value);const bits=view.getBigUint64(0);
 const sign=bits>>63n?-1n:1n,exponent=Number((bits>>52n)&2047n),mantissa=bits&((1n<<52n)-1n);
 let n=sign*(exponent===0?mantissa:mantissa+(1n<<52n)),d=1n,power=(exponent===0?-1022:exponent-1023)-52;
 if(power>=0)n<<=BigInt(power);else d<<=BigInt(-power);const q=gcd(n<0n?-n:n,d);return {numerator:String(n/q),denominator:String(d/q)};
}
const exact=point=>point.map(frac);
function faceFrom(plane,loop,options){
 const p=options.resultIdPrefix,n=loop.edges.length;
 return {sourceVersion:0,plane:clone(plane),loop:clone(loop),options:clone(options),
 topology:{vertices:loop.edges.map((edge,i)=>({id:p+'_v_'+i,point:clone(edge.controlPoints[0])})),
 edges:loop.edges.map((edge,i)=>({id:p+'_e_'+i,curveId:edge.id,vertexIds:[p+'_v_'+i,p+'_v_'+(i+1)%n]})),
 loop:{uses:loop.edges.map((edge,i)=>({id:p+'_use_'+i,curveId:edge.id,edgeId:p+'_e_'+i,pcurveId:p+'_uv_'+i,
 vertexIds:[p+'_v_'+i,p+'_v_'+(i+1)%n],sense:'forward',interval:[0,1]}))}},
 pcurves:loop.edges.map((edge,i)=>({id:p+'_uv_'+i,curveId:edge.id,edgeId:p+'_e_'+i,domain:[0,1],curve:{degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[[0,0],[1,0]]}})),
 bindings:Array.from({length:n*3},(_,i)=>({controlOnly:marker,index:i}))};
}
function solidFrom(assets,edgePairs,options){
 const {sourceId,face}=assets[0],p=options.resultIdPrefix,n=face.loop.edges.length;
 const points=face.topology.vertices.map(v=>v.point),a=face.plane.controlPoints[0][0],b=face.plane.controlPoints[0][1],c=face.plane.controlPoints[1][0];
 const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 return {controlOnly:marker,request:{assets:clone(assets),edgePairs:clone(edgePairs),options:clone(options)},
 graph:{vertices:points.map((pointMM,i)=>({id:p+'_v_'+i,pointMM:clone(pointMM),members:[{sourceId,faceId:face.options.faceId,vertexId:face.topology.vertices[i].id}]})),
 edges:face.topology.loop.uses.map((use,i)=>({id:p+'_e_'+i,vertexIds:[p+'_v_'+i,p+'_v_'+(i+1)%n],pairIndex:i,parameterMapAtoB:{scale:frac(1),offset:frac(0)},uses:[{sourceId,use:clone(use)}]})),
 faces:[{sourceId,faceId:face.options.faceId,surfaceId:face.plane.id,loopId:face.loop.id,vertexIds:points.map((_,i)=>p+'_v_'+i),edgeIds:points.map((_,i)=>p+'_e_'+i)}],
 vertexLinks:points.map((_,i)=>({vertexId:p+'_v_'+i,cycleEdgeIds:[p+'_e_'+(i+n-1)%n,p+'_e_'+i],arcs:[{sourceId,faceId:face.options.faceId,fromEdgeId:p+'_e_'+(i+n-1)%n,toEdgeId:p+'_e_'+i}]}))},
 supports:[{sourceId,faceId:face.options.faceId,surfaceId:face.plane.id,originMM:exact(a),outwardNormal:exact(normal),offset:frac(normal.reduce((sum,x,i)=>sum+x*a[i],0))}],
 certificate:{controlOnly:marker,solid:false,strictInteriorMM:exact(a),volumeMM3:frac(1)},report:{controlOnly:marker,solid:true}};
}
function inertParent(x=0,y=-0,z=0){
 const points=[[x,y,z],[x+1,y,z],[x,y+1,z]],edges=points.map((point,i)=>({kind:'curve',id:'c'+i,degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[point,points[(i+1)%3]]}));
 const plane={kind:'surface',id:'surface',degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],weights:[[1,1],[1,1]],controlPoints:[[points[0],points[1]],[points[2],[x+1,y+1,z]]]};
 const face=faceFrom(plane,{id:'loop',edges},{faceId:'face',evaluationId:'model',resultIdPrefix:'local',orientation:'forward'});
 return solidFrom([{sourceId:'source',face}],[],{solidId:'parent_solid',resultIdPrefix:'parent'});
}
async function harness(entry, legacySource) {
  assert.ok(existsSync(entry), 'Checked source/emitted leaf must exist: ' + entry);
  assert.match(basename(entry), /^modeling-rotation-internal\.(?:ts|js)$/);
  const mode = legacySource ? 'legacy-source' : extname(entry) === '.ts' ? 'source' : 'emitted';
  const trapKey = Symbol.for('barocss.rotation-pivot-internal.zero-native.' + mode);
  assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap'); keys.push(trapKey);
  const state = { open: false, calls: [], unexpected: [], validatorError: undefined, faceError: undefined, qualifierError: undefined, alterFace: undefined, alterTarget: undefined, history: [] };
  const dispatch = (binding, args) => {
    if (!state.open) { state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding); }
    const call = { binding, args }; state.calls.push(call); state.history.push(call);
    if (binding === 'validateConvexPlanarSolid') {
      if (state.validatorError) throw state.validatorError;
      return call.result = clone(args[0].report);
    }
    if(binding==='buildConvexPlanarFace'){
      if(state.faceError)throw state.faceError;
      call.result=faceFrom(...args);if(state.alterFace)state.alterFace(call.result);return call.result;
    }
    if(binding==='qualifyConvexPlanarSolid'){
      if(state.qualifierError)throw state.qualifierError;
      call.result=solidFrom(...args);if(state.alterTarget)state.alterTarget(call.result);return call.result;
    }
    state.unexpected.push(binding); throw new Error('UNKNOWN_PROVIDER_ATTEMPT: ' + binding);
  };
  globalThis[trapKey] = { dispatch };
  const replaced = new Set();
  const bundle = await build({ stdin: { contents: `${legacySource ?? ('export * from ' + JSON.stringify(entry) + ';')}
    export {SolidSnapshotLedger,ConvexPlanarSolidError} from './convex-planar-solid-proof-internal.js';
    export {SectionRationalContext} from './section-rational-internal.js';`, resolveDir: dirname(entry), loader: legacySource ? 'ts' : 'js' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
    plugins: [{ name: 'rotation-pivot-native-traps', setup(build) {
      build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
        const key = basename(args.path, extname(args.path));
        if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'pivot-trap' }; }
        assert.ok(allowed.has(key), 'Unreviewed implementation cannot enter leaf control: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'pivot-trap' }, args => ({ contents:
        providers.get(args.path).map(binding=>`export function ${binding}(...args){return globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(trapKey))})].dispatch(${JSON.stringify(binding)},args);}`).join('\n'),loader:'js' }));
    } }] });
  assert.deepEqual([...replaced].sort(), [...providers.keys()].sort());
  const actual = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('pivot-trap:') && path !== '<stdin>')
    .map(path => basename(path, extname(path))).sort();
  assert.deepEqual(actual, [...allowed].filter(key => !legacySource || key !== 'modeling-rotation-internal').sort(), 'Only actual leaf, ledger/proof and rational implementations remain');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  let provenance;
  if(process.env.EVIDENCE_DIR){
    const directory=resolve(process.env.EVIDENCE_DIR,'modeling-rotation-pivot-internal-'+mode);mkdirSync(dirname(directory),{recursive:true});mkdirSync(directory);
    const save=(name,bytes)=>{writeFileSync(resolve(directory,name),bytes,{flag:'wx'});return {sha256:createHash('sha256').update(bytes).digest('hex'),bytes:Buffer.byteLength(bytes)};};
    provenance={directory,mode,entry,bundle:save('bundle.mjs',bundle.outputFiles[0].text),metafile:save('metafile.json',JSON.stringify(bundle.metafile,null,2)+'\n'),inputs:save('input-hashes.json',JSON.stringify(Object.fromEntries(Object.keys(bundle.metafile.inputs).filter(path=>!path.startsWith('pivot-trap:')&&path!=='<stdin>').map(path=>[path,createHash('sha256').update(readFileSync(resolve(path))).digest('hex')])),null,2)+'\n'),replacedBindings:[...providers.values()].flat()};
    if(legacySource)provenance.legacySource=save('legacy-provider.ts.txt',legacySource);
  }
  return { mode, state, api, provenance, run(action, options = {}) {
    state.calls = []; state.validatorError = options.validatorError; state.faceError=options.faceError;state.qualifierError=options.qualifierError;state.alterFace=options.alterFace;state.alterTarget=options.alterTarget;
    state.open = true;
    try { return action(api.buildModelingRotation); } finally { state.open = false; }
  } };
}
function refusal(action,code,stage){let error;try{action();}catch(cause){error=cause;}assert.equal(error?.name,'ModelingRotationError');if(code)assert.equal(error.code,code);if(stage)assert.equal(error.stage,stage);assert.ok(Object.isFrozen(error.report));assert.equal(Object.hasOwn(error,'solid'),false);return error;}
const legacyPath=resolve(process.env.CAD_ROTATION_PIVOT_LEGACY_SOURCE??fileURLToPath(new URL('./evidence/cardinal-pivot-2015/legacy-rotation-internal.ts.txt',import.meta.url)));
const legacySource=readFileSync(legacyPath,'utf8');assert.equal(createHash('sha256').update(legacySource).digest('hex'),'6cc0461c1e58cf0211e117e6a3b437f9cd9ce2c9b3b1e51a016d27f9f1878152');
const legacy=await harness(entries[0],legacySource),controls=await Promise.all(entries.map(entry=>harness(entry)));
for(const control of controls){const {mode,state,run}=control;const calls=binding=>state.calls.filter(c=>c.binding===binding);
const noFaces=()=>assert.equal(calls('buildConvexPlanarFace').length,0);
test(mode+': omitted pivot complete result, property order and exact work equal frozen original leaf',()=>{
 for(const axis of ['x','y','z'])for(const degrees of [90,180,270]){const parent=inertParent(),before=clone(parent),spec={axis,degrees};
 const old=legacy.run(build=>build(parent,spec,'p')),current=run(build=>build(parent,spec,'p'));assert.deepEqual(current,old);assert.equal(JSON.stringify(current),JSON.stringify(old));assert.deepEqual(current.report.exactWork,old.report.exactWork);assert.deepEqual(parent,before);assert.equal(Object.isFrozen(parent),false);}
});
test(mode+': explicit zero keeps stored signed coefficient bits and adds only authored request pivot',()=>{
 for(const axis of ['x','y','z'])for(const degrees of [90,180,270]){const parent=inertParent(),old=legacy.run(build=>build(parent,{axis,degrees},'p'));
 const result=run(build=>build(parent,{axis,degrees},'p',[0,-0,0]));assert.deepEqual(result.solid,old.solid);assert.deepEqual(result.lineage,old.lineage);
 assert.deepEqual(Object.keys(result.request),['parent','spec','prefix','pivotMM']);assert.deepEqual(result.request.pivotMM,[0,-0,0]);
 assert.equal(Object.hasOwn(result.report.preservation,'supportOffsetsUnchanged'),false);assert.ok(Object.values(result.report.preservation).every(v=>v===true));}
});
test(mode+': pivot affine support equations and all eight synthetic lineage classes are checked',()=>{
 const parent=inertParent(2,3,4),result=run(build=>build(parent,{axis:'x',degrees:90},'p',[16,12,4]));
 assert.deepEqual(result.solid.request.assets[0].face.plane.controlPoints[0][0],[2,12, -5]);
 assert.deepEqual(result.solid.supports[0].outwardNormal,exact([0,-1,0]));assert.deepEqual(result.solid.supports[0].offset,frac(-12));
 assert.deepEqual(Object.fromEntries(Object.entries(result.lineage).map(([k,v])=>[k,v.length])),{faces:1,curves:3,pcurves:3,uses:3,localEdges:3,localVertices:3,edges:3,vertices:3});
 assert.deepEqual(result.report.directCalls,{parentValidationCount:1,initialFaceConstructionCount:1,targetQualificationCount:1,retries:0});
 assert.equal(result.solid.certificate.solid,false,'Synthetic certificate is deliberately not authentic Native evidence');
});
test(mode+': pivot on unchanged axis accepts smallest subnormal and preserves zero-affine signed bits',()=>{
 const result=run(build=>build(inertParent(),{axis:'z',degrees:90},'p',[0,0,Number.MIN_VALUE]));
 assert.ok(Object.is(result.solid.request.assets[0].face.plane.controlPoints[0][0][0],0));assert.deepEqual(result.request.pivotMM,[0,0,Number.MIN_VALUE]);
 const unchangedAxis=run(build=>build(inertParent(Number.MIN_VALUE),{axis:'x',degrees:90},'p',[10000,0,0]));assert.ok(Object.is(unchangedAxis.solid.request.assets[0].face.plane.controlPoints[0][0][0],Number.MIN_VALUE));
});
test(mode+': rational displacement beyond coordinate bound is allowed when final coefficients fit',()=>{
 const result=run(build=>build(inertParent(-10000),{axis:'y',degrees:180},'p',[-6000,0,0]));
 assert.deepEqual(result.solid.request.assets[0].face.plane.controlPoints[0][0],[-2000,-0,-0]);assert.deepEqual(result.solid.request.assets[0].face.plane.controlPoints[0][1],[-2001,-0,-0]);
});
test(mode+': unrepresented .1 plus .2 displacement stages exact cancellation before first Face',()=>{
 const parent=inertParent();const face=parent.request.assets[0].face;
 for(const row of face.plane.controlPoints)for(const point of row){point[0]=.1;point[1]=.2;}
 for(const curve of face.loop.edges)for(const point of curve.controlPoints){point[0]=.1;point[1]=.2;}
 const sentinel=new Error('inert first Face boundary');const error=refusal(()=>run(build=>build(parent,{axis:'z',degrees:90},'p',[.1,.2,0]),{faceError:sentinel}),'NATIVE','face-construction');
 assert.equal(error.cause,sentinel);assert.equal(calls('buildConvexPlanarFace').length,1);assert.deepEqual(calls('buildConvexPlanarFace')[0].args[0].controlPoints[0][0],[.1,.2,0]);assert.equal(calls('qualifyConvexPlanarSolid').length,0);
});
test(mode+': nonzero exact cancellation produces positive zero while zero offsets retain signs',()=>{
 const result=run(build=>build(inertParent(-2,-0,0),{axis:'y',degrees:180},'p',[-1,0,0]));
 const point=result.solid.request.assets[0].face.plane.controlPoints[0][0];assert.ok(Object.is(point[0],0));assert.ok(Object.is(point[1],-0));assert.ok(Object.is(point[2],-0));
});
test(mode+': final unrepresentable coefficient refuses before all Face calls',()=>{
 const error=refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',[16,.1,4])),'REPRESENTABILITY','stage-coefficients');noFaces();assert.equal(calls('validateConvexPlanarSolid').length,1);assert.equal(error.report.directCalls.initialFaceConstructionCount,0);
});
test(mode+': late Line pole overflow is staged before any Face',()=>{
 const parent=inertParent();parent.request.assets[0].face.loop.edges[2].controlPoints[1][0]=-10000;
 refusal(()=>run(build=>build(parent,{axis:'y',degrees:180},'p',[1,0,0])),'REPRESENTABILITY','stage-coefficients');noFaces();
});
test(mode+': complete original namespace collision refuses before Face construction',()=>{
 for(const alter of [p=>p.graph.edges[0].id='p_s_e_0',p=>p.request.assets[0].face.pcurves[0].id='p_f0_uv_0']){const parent=inertParent();alter(parent);refusal(()=>run(build=>build(parent,{axis:'x',degrees:90},'p',[0,0,0])),'IDENTITY','identity');noFaces();}
});
test(mode+': dense finite pivot and exact fourth argument arity are required before validation',()=>{
 for(const pivot of [undefined,null,[],[1,2],[1,2,3,4],[,1,2],['1',0,0],[NaN,0,0],[Infinity,0,0],[10001,0,0]]){refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',pivot)),'INPUT');assert.equal(state.calls.length,0);}
 refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',[0,0,0],true)),'INPUT');assert.equal(state.calls.length,0);
});
test(mode+': parent, pivot and spec getters never execute and symbol fields refuse',()=>{
 let reads=0;const parent=inertParent();Object.defineProperty(parent,'report',{enumerable:true,get(){reads++;return {};}});
 const pivot=[1,2,3];Object.defineProperty(pivot,'0',{enumerable:true,get(){reads++;return 1;}});
 const spec={axis:'x',degrees:90};Object.defineProperty(spec,'axis',{enumerable:true,get(){reads++;return 'x';}});
 for(const args of [[parent,{axis:'x',degrees:90},'p',[0,0,0]],[inertParent(),{axis:'x',degrees:90},'p',pivot],[inertParent(),spec,'p',[0,0,0]]]){refusal(()=>run(build=>build(...args)),'INPUT','snapshot');assert.equal(state.calls.length,0);}
 const symbolic=[0,0,0];symbolic[Symbol()]=1;refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',symbolic)),'INPUT');assert.equal(reads,0);
});
test(mode+': extra pivot inside private spec remains forbidden and caller data stays mutable',()=>{
 refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90,pivot:[0,0,0]},'p')),'INPUT','admission');assert.equal(state.calls.length,0);
 const parent=inertParent(),pivot=[16,12,4],before=clone(parent),result=run(build=>build(parent,{axis:'x',degrees:90},'p',pivot));assert.deepEqual(parent,before);assert.equal(Object.isFrozen(parent),false);assert.equal(Object.isFrozen(pivot),false);assert.notEqual(result.request.pivotMM,pivot);pivot[1]=99;assert.deepEqual(result.request.pivotMM,[16,12,4]);
});
test(mode+': original validator, builder and qualifier causes survive without partial result',()=>{
 for(const field of ['validatorError','faceError','qualifierError']){const cause=new Error('inert '+field),error=refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',[0,0,0]),{[field]:cause}),'NATIVE');assert.equal(error.cause,cause);assert.equal(Object.isFrozen(cause),false);}
});
test(mode+': false staged Face coefficients refuse before qualifier',()=>{
 refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',[16,12,4]),{alterFace(face){face.plane.controlPoints[0][0][0]+=1;}}),'OWNED','face-lineage');assert.equal(calls('qualifyConvexPlanarSolid').length,0);
});
test(mode+': false support equation or target retained inventory refuses after qualifier',()=>{
 for(const alterTarget of [solid=>solid.supports[0].offset=frac(123),solid=>solid.request.edgePairs.push({false:true})]){
 const error=refusal(()=>run(build=>build(inertParent(),{axis:'x',degrees:90},'p',[16,12,4]),{alterTarget}));assert.ok(['BINDING','OWNED'].includes(error.code));assert.equal(calls('qualifyConvexPlanarSolid').length,1);}
});
}
after(()=>{for(const {state,provenance} of [...controls,legacy]){assert.deepEqual(state.unexpected,[]);assert.equal(state.open,false);if(provenance)writeFileSync(resolve(provenance.directory,'receipt.json'),JSON.stringify({issue:2015,realNativeGeometryCalls:0,unexpectedProviderAttempts:state.unexpected,inertBindingCalls:state.history.length,scope:'actual rotation leaf and unchanged rational/ledger; synthetic one-Face data, no authentic Native geometry or certificate',provenance},null,2)+'\n',{flag:'wx'});}for(const key of keys)delete globalThis[key];});
