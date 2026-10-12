import { convexBody } from './modeling-regeneration-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector';
import { mkdirSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serial } from './modeling-fixture.mjs';
const api = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const { cad, CadModelError } = api;
const frac = n => ({ numerator: String(n), denominator: '1' });
function prove(solid, volume) {
  assert.deepEqual(solid.certificate.volumeMM3, frac(volume));
  assert.equal(solid.graph.vertices.length - solid.graph.edges.length + solid.graph.faces.length, 2);
  assert.ok(solid.graph.edges.every(e => e.uses.length === 2));
  // Independent signed tetrahedron sum, using this campaign's exact dyadic coordinates.
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
  let six = 0;
  for (const asset of solid.request.assets) {
    const face = asset.face, points = face.topology.loop.uses.map(u => face.loop.edges.find(c=>c.id===u.curveId).controlPoints[u.sense==='forward'?0:1]);
    for (let i=1;i+1<points.length;i++) six += dot(points[0],cross(points[i],points[i+1]));
  }
  assert.equal(six,volume*6);
  assert.equal(Object.isFrozen(solid),true);
  assert.equal(Object.isFrozen(solid.graph.vertices[0].pointMM),true);
}
function refuses(fn, code) { assert.throws(fn, e => { assert.ok(e instanceof CadModelError, String(e)); if (code) assert.equal(e.code,code); return true; }); }

test('real native authoring, exact cut/chamfer, atomic parameters and bounded evidence', async () => {
  assert.ok(process.execArgv.includes('--no-opt'), 'Run this explicit native campaign with --no-opt');
  const output=process.env.CAD_MODEL_EVIDENCE_DIR; if(output) mkdirSync(output,{recursive:true});
  const inspector=new Session();inspector.connect(); const post=(method,params={})=>new Promise((yes,no)=>inspector.post(method,params,(e,r)=>e?no(e):yes(r)));
  await post('Profiler.enable');await post('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
  const names=['compileCadModel','buildConvexPlanarFace','evaluateCurveD1','evaluateSurfaceD1','ExactAffinePlane','SectionRationalContext'];
  const counts=Object.fromEntries(names.map(n=>[n,0])), stages=[];let pending=null;
  const write=(name,data)=>{if(output){assert.ok(statfsSync(output).bavail*statfsSync(output).bsize>=500*1024*1024);const text=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';assert.ok(Buffer.byteLength(text)<1024*1024);writeFileSync(resolve(output,name),text);}};
  const run=async(label,fn)=>{assert.ok(stages.length<15);assert.ok(counts.compileCadModel<=4400&&counts.buildConvexPlanarFace<=4400&&counts.evaluateCurveD1+counts.evaluateSurfaceD1<=175000);pending=label;let value;try{value=fn();}finally{const raw=await post('Profiler.takePreciseCoverage');const observed=Object.fromEntries(names.map(n=>[n,raw.result.flatMap(s=>s.functions.filter(f=>f.functionName===n)).reduce((v,f)=>v+f.ranges[0].count,0)]));for(const n of names)counts[n]+=observed[n];stages.push({label,observed});write('native-counts.json',{pending,stages,counts});assert.ok(observed.compileCadModel<=600&&observed.buildConvexPlanarFace<=600&&observed.evaluateCurveD1+observed.evaluateSurfaceD1<=25000);assert.ok(counts.compileCadModel<=5000&&counts.buildConvexPlanarFace<=5000&&counts.evaluateCurveD1+counts.evaluateSurfaceD1<=200000);}pending=null;return value;};
  try {
    const m=cad.model(), width=m.parameter('width',80), plate=m.sketch.rectangle({width,height:60}).extrude(10);
    const original=await run('user rectangle width80',()=>m.build({plate}));prove(convexBody(original,'plate'),48000);const saved=original.save();
    const wider=await run('rectangle width100 update',()=>original.withParameters({width:100}));prove(convexBody(wider,'plate'),60000);assert.equal(original.save(),saved);write('rectangle.cad-model.json',wider.save());
    const fixture=serial(cad), initial=await run('pentagon cut positive chamfer',fixture.build), baseline=initial.save();
    prove(convexBody(initial,'part'),3064);prove(convexBody(initial,'other'),2048);assert.deepEqual(Object.keys(initial.bodies),['part','other']);
    assert.equal(initial.evidence[4].kind,'cut');assert.deepEqual(initial.evidence[4].native.report.volumeMM3.parent,frac(7168));assert.deepEqual(initial.evidence[4].native.report.volumeMM3.second,frac(3072));
    assert.equal(initial.evidence[5].native.split.request.parent.request.options.solidId,initial.evidence[4].native.second.outcome.solid.request.options.solidId);assert.deepEqual(initial.evidence[5].native.metric.removedVolumeMM3,frac(8));
    const edited=await run('batch height6 rearX20',()=>initial.withParameters({height:6,rearX:20}));prove(convexBody(edited,'part'),2488);assert.equal(initial.save(),baseline);assert.deepEqual(edited.parameters,{height:6,setback:1,rearX:20,upperX:16});write('serial.cad-model.json',edited.save());
    prove(convexBody(await run('setback2',()=>initial.withParameters({setback:2})),'part'),3040);
    prove(convexBody(await run('cut upperX24',()=>initial.withParameters({upperX:24})),'part'),1276);
    for(const [label,edits] of [['non-dyadic 80/3',{rearX:20,upperX:24}],['tool misses taller parent',{height:10}],['setback locality',{setback:8}],['empty positive side',{upperX:32}]]){
      await run(label,()=>assert.throws(()=>initial.withParameters(edits),e=>{assert.ok(e instanceof CadModelError);assert.ok(e.code==='NATIVE'||e.code==='SELECTION');write(label.replaceAll(/[^a-z0-9]/gi,'-')+'.refusal.json',{code:e.code,operation:e.operation,message:e.message,cause:e.cause?.message,causeCode:e.cause?.code});return true;}));assert.equal(initial.save(),baseline);prove(convexBody(initial,'part'),3064);
    }
    refuses(()=>initial.withParameters({unknown:2}),'PARAMETER');refuses(()=>initial.withParameters({height:6,setback:NaN}),'PARAMETER');assert.equal(initial.save(),baseline);
    const malformed=JSON.parse(baseline);malformed.unexpected=true;refuses(()=>cad.load(JSON.stringify(malformed)),'INPUT');
    const cyclic=JSON.parse(baseline);cyclic.nodes[1].sketch=1;refuses(()=>cad.load(JSON.stringify(cyclic)),'INPUT');
    assert.ok(baseline.includes('-0'));assert.equal(Object.is(initial.evidence[0].native.document.points[0].position[0],-0),true);
    await run('ambiguous deferred edge',()=>refuses(serial(cad,{parallelTo:'x'}).build,'SELECTION'));
    await run('missing deferred edge',()=>refuses(serial(cad,{parallelTo:'x',at:{y:999,z:'max'}}).build,'SELECTION'));
    const cutFixture=serial(cad,{},false);
    refuses(()=>cutFixture.blank.cut(cutFixture.tool,{axis:'x'}),'CAPABILITY');
    refuses(()=>cutFixture.model.sketch.rectangle({width:8,height:8}),'CAPABILITY');
    const cutOnly=await run('cut-only after refused graph additions',cutFixture.build);prove(convexBody(cutOnly,'part'),3072);write('cut.cad-model.json',cutOnly.save());
    const y=cad.model(), box=y.sketch.polygon([[0,32],[32,32],[32,0],[0,0]]).extrude(8), tool=y.sketch.polygon([[-16,16],[48,16],[48,8],[-16,8]]).extrude(8), split=box.cut(tool,{axis:'y'});
    const yresult=await run('y cut clockwise polygons',()=>y.build({negative:split.negative,positive:split.positive}));prove(convexBody(yresult,'negative'),2048);prove(convexBody(yresult,'positive'),4096);assert.ok(convexBody(yresult,'negative').graph.vertices.every(v=>v.pointMM[1]<=8));assert.ok(convexBody(yresult,'positive').graph.vertices.every(v=>v.pointMM[1]>=16));
    const bad=cad.model(), concave=bad.sketch.polygon([[0,0],[8,0],[2,2],[8,8],[0,8]]).extrude(8);await run('native concave refusal',()=>refuses(()=>bad.build({part:concave}),'NATIVE'));
    assert.equal(original.save(),saved);m.parameter('later',5);assert.equal(original.save(),saved);
    assert.ok(counts.compileCadModel>0&&counts.buildConvexPlanarFace>0&&counts.evaluateCurveD1>0&&counts.evaluateSurfaceD1>0);
    write('native-result.json',{status:'passed',stages:stages.length,actual:counts});
  } catch(e){write('first-failure.json',{pending,stages,counts,message:e.message,stack:e.stack,cause:e.cause?.message});throw e;}
  finally{await post('Profiler.stopPreciseCoverage');inspector.disconnect();}
});
