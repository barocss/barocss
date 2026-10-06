import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAxisRectangleExtrusion,buildXYProfile,compileCadModel,buildParametricFace,buildAxisBoxShell,validateAxisBoxShell,validateAxisBoxSolid,evaluateCurve,evaluateCurveD1,evaluateSurfaceD1,exportIGES } from '../dist/index.js';
const request={bodyId:'body',profile:{kind:'rectangle',id:'profile',origin:[4,-3],width:7,height:5},distance:6};
const table=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const normals=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const names=['x_min','x_max','y_min','y_max','z_min','z_max'];
const parameterIds={originX:'_rect_ox',originY:'_rect_oy',width:'_rect_w',height:'_rect_h',distance:'_rect_d'};
const close=(a,b)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<=1e-9,`${a} versus ${b}`);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function corners(r){const [x,y]=r.profile.origin;return Array.from({length:8},(_,i)=>[i&1?x+r.profile.width:x,i&2?y+r.profile.height:y,i&4?r.distance:0]);}
function check(r){const result=buildAxisRectangleExtrusion(r),p=corners(r),w=r.profile.width,h=r.profile.height,d=r.distance;
  assert.equal(result.sourceVersion,2);assert.equal(result.model.version,0);assert.equal(result.model.objects.length,7);assert.equal(result.ir.schemaVersion,2);assert.equal(result.ir.sourceVersion,2);
  const compiled=compileCadModel(result.source,{sourceVersion:2});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,result.model);assert.deepEqual(compiled.ir,result.ir);
  assert.deepEqual(result.profile,buildXYProfile(r.profile));assert.equal(result.profile.report.regionCertified,false);assert.deepEqual(result.model.objects[0],result.profile.curve);
  assert.deepEqual(result.ir.parameters.map(p=>[p.id,p.quantityKind,p.value,p.unit]),[['_rect_ox','length',r.profile.origin[0],'mm'],['_rect_oy','length',r.profile.origin[1],'mm'],['_rect_w','length',w,'mm'],['_rect_h','length',h,'mm'],['_rect_d','length',d,'mm']]);
  assert.ok(result.ir.bindings.length>0);assert.ok(result.ir.dependencies.filter(x=>x.kind==='parameter-input').length>0);
  assert.deepEqual(result.solidReport,{valid:true,geometryFamily:'exact-axis-box-solid-v0',closed:true,solid:true,volumeMM3:w*h*d,areaMM2:2*(w*h+w*d+h*d),boundsMM:{min:p[0],max:p[7]}});
  assert.deepEqual(validateAxisBoxShell(result.shell),{incidenceValid:true,geometryFamily:'exact-axis-box-shell-v0',closed:true,solid:false,solidProductImplemented:false});assert.deepEqual(validateAxisBoxSolid(result.shell),result.solidReport);
  assert.deepEqual(result.shell.origin,p[0]);assert.deepEqual(result.shell.sides,[w,h,d]);assert.deepEqual(result.shell.vertices.map(v=>v.point),p);assert.equal(result.shell.faces.length,6);assert.equal(result.shell.edges.length,12);assert.equal(result.shell.edges.reduce((n,e)=>n+e.uses.length,0),24);
  const ids=[result.shell.id,...result.shell.faces.map(f=>f.id),...result.shell.vertices.map(v=>v.id),...result.shell.edges.map(e=>e.id)];assert.equal(new Set(ids).size,27);assert.ok(ids.every(id=>id.length<=128));
  const surfaces=result.model.objects.slice(1);assert.equal(result.faces.length,6);assert.deepEqual(surfaces.map(s=>s.id),names.map(name=>`${r.bodyId}_${name}_surface`));assert.equal(result.shell.id,`${r.bodyId}_shell`);assert.deepEqual(result.shell.faces.map(f=>f.id),names.map(name=>`${r.bodyId}_face_${name}`));assert.deepEqual(result.shell.vertices.map(v=>v.id),Array.from({length:8},(_,i)=>`${r.bodyId}_v${i}`));assert.deepEqual(result.shell.edges.map(e=>e.id),Array.from({length:12},(_,i)=>`${r.bodyId}_e${i}`));
  for(let i=0;i<6;i++){const c=table[i].map(k=>p[k]),s=surfaces[i];assert.equal(s.kind,'surface');assert.deepEqual(s.controlPoints,[[c[0],c[3]],[c[1],c[2]]]);assert.deepEqual(s.weights,[[1,1],[1,1]]);assert.equal(s.degreeU,1);assert.equal(s.degreeV,1);assert.deepEqual(s.knotsU,[0,0,1,1]);assert.deepEqual(s.knotsV,[0,0,1,1]);assert.deepEqual(result.faces[i].geometry.objects[0],s);
    for(const [u,v] of [[0,0],[.25,.75],[.5,.5],[1,1]]){const actual=evaluateSurfaceD1(s,u,v),a=c[1].map((x,k)=>x-c[0][k]),b=c[3].map((x,k)=>x-c[0][k]);close(actual.point,c[0].map((x,k)=>x+u*a[k]+v*b[k]));close(actual.du,a);close(actual.dv,b);const n=cross(actual.du,actual.dv),length=Math.hypot(...n);close(n.map(x=>x/length),normals[i]);}
  }
  const construction=result.construction;assert.deepEqual(Object.keys(construction).sort(),['operation','inputCurveId','outputBodyId','direction','distanceMM','parameterIds','footprintRanges'].sort());assert.equal(construction.operation,'axis-rectangle-extrude');assert.equal(construction.inputCurveId,r.profile.id);assert.equal(construction.outputBodyId,r.bodyId);assert.deepEqual(construction.direction,[0,0,1]);assert.equal(construction.distanceMM,d);assert.deepEqual(construction.parameterIds,parameterIds);
  const pairs=[[0,1],[1,3],[2,3],[0,2]],senses=['forward','forward','reverse','reverse'];assert.equal(construction.footprintRanges.length,4);
  for(let span=0;span<4;span++){const mapping=construction.footprintRanges[span];assert.deepEqual(mapping.inputRange,[span,span+1]);assert.equal(mapping.sense,senses[span]);const edge=result.shell.edges.find(e=>e.id===mapping.edgeId);assert.ok(edge);assert.deepEqual(edge.vertexIds,pairs[span].map(k=>result.shell.vertices[k].id));
    const a=p[pairs[span][0]],b=p[pairs[span][1]],sign=senses[span]==='forward'?1:-1;
    for(const t of [0,.125,.5,.875,1]){const native=evaluateCurve(result.profile.curve,span+t),et=sign===1?t:1-t;close(native,a.map((x,k)=>x+et*(b[k]-x)));if(t>0&&t<1)close(evaluateCurveD1(result.profile.curve,span+t).derivative,b.map((x,k)=>sign*(x-a[k])));}
  }
  for(const knot of [1,2,3])assert.throws(()=>evaluateCurveD1(result.profile.curve,knot));return result;
}
test('supported 7x5x6 construction has exact source2/native box, outward normals, solid and footprint evidence',()=>{check(request);});
test('unit, signedzero, integer maximum and shifted boundary cases retain supported family',()=>{
  check({bodyId:'unit',profile:{kind:'rectangle',id:'p',origin:[-0,-0],width:1,height:1},distance:1});
  check({bodyId:'max',profile:{kind:'rectangle',id:'p',origin:[-10000,-10000],width:10000,height:10000},distance:10000});
  check({bodyId:'shift',profile:{kind:'rectangle',id:'p',origin:[9999,-10000],width:1,height:1},distance:1});
});
function faceIds(bundle){return {faceId:bundle.topology.face.id,loopId:bundle.topology.loop.id,vertexIds:bundle.topology.vertices.map(v=>v.id),edgeIds:bundle.topology.edges.map(e=>e.id),curveIds:bundle.topology.edges.map(e=>e.curveId)};}
function shellIds(shell){return {shellId:shell.id,faceIds:shell.faces.map(f=>f.id),vertexIds:shell.vertices.map(v=>v.id),edgeIds:shell.edges.map(e=>e.id)};}
test('actual source width edit recompiles and fresh face/shell/solid guards prove new 8x5x6 data',()=>{
  const result=buildAxisRectangleExtrusion(request),edited=result.source.replace(/(@parameter\s+#_rect_w\s*\{[^}]*value\s*:\s*)7\s*mm\s*;/,(_,prefix)=>prefix+'8mm;');assert.notEqual(edited,result.source);
  const compiled=compileCadModel(edited,{sourceVersion:2});assert.equal(compiled.ok,true);assert.equal(compiled.model.objects[0].controlPoints[1][0],12);
  const faces=compiled.model.objects.slice(1).map((surface,i)=>buildParametricFace(surface,faceIds(result.faces[i])));const shell=buildAxisBoxShell([4,-3,0],[8,5,6],faces,shellIds(result.shell));const report=validateAxisBoxSolid(shell);assert.equal(report.volumeMM3,240);assert.equal(report.areaMM2,236);assert.equal(result.solidReport.volumeMM3,210);assert.notDeepEqual(shell,result.shell);
  const inward=structuredClone(faces);const surface=inward[0].geometry.objects[0];surface.controlPoints.reverse();const nativeInward=buildParametricFace(surface,faceIds(result.faces[0]));assert.throws(()=>buildAxisBoxShell([4,-3,0],[8,5,6],[nativeInward,...faces.slice(1)],shellIds(result.shell)));
  assert.throws(()=>buildAxisBoxShell([4,-3,0],[8,5,6],faces.slice(0,5),shellIds(result.shell)));
  const bad=structuredClone(shell);bad.edges[0].uses[1].sense='forward';assert.throws(()=>validateAxisBoxSolid(bad));
});
test('integer operation limits, exact field/ID family and corner bounds reject before partial adoption',()=>{
  const bad=[null,[],{}, {...request,distance:0},{...request,distance:-1},{...request,distance:.5},{...request,distance:10001},{...request,distance:NaN},{...request,direction:[0,0,-1]}, {...request,plane:'xz'}, {...request,bodyId:request.profile.id},{...request,bodyId:'a'.repeat(81)},{...request,bodyId:'é'},
    ...[.5,0,-1,10001,Infinity].map(width=>({...request,profile:{...request.profile,width}})),
    {...request,profile:{...request.profile,origin:[4.5,-3]}},{...request,profile:{...request.profile,origin:[10000,0]}},{...request,profile:{...request.profile,origin:[0]}},{...request,profile:{...request.profile,kind:'circle'}},{...request,profile:{...request.profile,angle:0}},
    ...Object.values(parameterIds).flatMap(id=>[{...request,profile:{...request.profile,id}},{...request,bodyId:id}]),
    {...request,profile:{...request.profile,id:request.bodyId+'_face_x_min'}},
  ];const before=buildAxisRectangleExtrusion(request);for(const input of bad)assert.throws(()=>buildAxisRectangleExtrusion(input));assert.deepEqual(buildAxisRectangleExtrusion(request),before);
  const valid=buildAxisRectangleExtrusion({...request,bodyId:'a'.repeat(80),profile:{...request.profile,id:'b'.repeat(128)}});assert.equal(valid.construction.outputBodyId.length,80);assert.ok(valid.shell.id.length<=128);
  for(const object of before.model.objects.slice(1))assert.throws(()=>buildAxisRectangleExtrusion({...request,profile:{...request.profile,id:object.id}}));
});
test('strict own-data snapshot rejects malformed records and getters without execution',()=>{
  let calls=0;for(const key of Object.keys(request)){const input={...request};Object.defineProperty(input,key,{enumerable:true,get(){calls++;return request[key];}});assert.throws(()=>buildAxisRectangleExtrusion(input));}
  const nested={...request,profile:{...request.profile}};Object.defineProperty(nested.profile,'width',{enumerable:true,get(){calls++;return 7;}});assert.throws(()=>buildAxisRectangleExtrusion(nested));assert.equal(calls,0);
  for(const input of [{...request,[Symbol('x')]:1},Object.assign(Object.create({x:1}),request),Object.create(request),{...request,profile:{...request.profile,origin:new Array(2)}},{...request,profile:{...request.profile,origin:Array(65).fill(0)}},{...request,profile:{...request.profile,origin:{0:4,1:-3,length:2}}}])assert.throws(()=>buildAxisRectangleExtrusion(input));
  const hidden={...request};Object.defineProperty(hidden,'x',{value:1});assert.throws(()=>buildAxisRectangleExtrusion(hidden));const cycle={...request};cycle.profile=cycle;assert.throws(()=>buildAxisRectangleExtrusion(cycle));
});
function collect(value,set){if(value&&typeof value==='object'){set.add(value);for(const child of Object.values(value))collect(child,set);}}
function unique(value,seen,inputs){if(value&&typeof value==='object'){assert.ok(!inputs.has(value),'caller/previous alias');assert.ok(!seen.has(value),'nested output occurrence alias');seen.add(value);for(const child of Object.values(value))unique(child,seen,inputs);}}
test('all nested result occurrences own arrays/data independently of frozen input and previous construction',()=>{
  const input=Object.freeze({...request,profile:Object.freeze({...request.profile,origin:Object.freeze([...request.profile.origin])})});const result=buildAxisRectangleExtrusion(input),inputs=new WeakSet();collect(input,inputs);unique(result,new WeakSet(),inputs);const prior=new WeakSet();collect(result,prior);unique(buildAxisRectangleExtrusion(input),new WeakSet(),prior);
  const before=structuredClone(result.shell);try{result.model.objects[1].controlPoints[0][0][0]=999;}catch{}assert.deepEqual(result.shell,before);
});
test('selected IGES stays Curve126/Surface128 data with no whole-solid interchange claim',()=>{
  const result=buildAxisRectangleExtrusion(request);const curve=exportIGES(result.model,[request.profile.id]);assert.equal(curve.report.objects[0].entity,126);const faces=exportIGES(result.model,result.model.objects.slice(1).map(o=>o.id));assert.deepEqual(faces.report.objects.map(o=>o.entity),[128,128,128,128,128,128]);
});
