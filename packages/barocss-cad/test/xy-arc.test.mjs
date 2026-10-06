import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildXYArc, buildXYProfile, compileCadModel, evaluateCurve, evaluateCurveD1, curveDomain, exportIGES } from '../dist/index.js';
const w=Math.SQRT1_2;
const rotate=(p,q)=>{let [x,y]=p;for(let i=0;i<q;i++)[x,y]=[-y,x];return [x,y];};
const close=(a,b,tol=1e-9)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<=tol,`${a} versus ${b}`);
// Original analytic rational Bernstein quotient, independent of native basis code.
function analytic(center,r,q,t) {
  const poles=[[r,0],[r,r],[0,r]].map(p=>rotate(p,q)), weights=[1,w,1];
  const basis=[(1-t)**2,2*t*(1-t),t*t], derivative=[-2*(1-t),2-4*t,2*t];
  const denominator=basis.reduce((s,b,i)=>s+b*weights[i],0), dDen=derivative.reduce((s,b,i)=>s+b*weights[i],0);
  const point=[],d=[];
  for(let axis=0;axis<2;axis++) {
    const numerator=basis.reduce((s,b,i)=>s+b*weights[i]*poles[i][axis],0);
    const dNum=derivative.reduce((s,b,i)=>s+b*weights[i]*poles[i][axis],0);
    point.push(center[axis]+numerator/denominator);d.push((dNum*denominator-numerator*dDen)/(denominator*denominator));
  }
  return {point:[...point,0],derivative:[...d,0]};
}
function check(request) {
  const result=buildXYArc(request),circle=request.kind==='circle',count=circle?9:3,max=circle?4:1;
  assert.deepEqual(result.report,{kind:request.kind,plane:'xy',lengthUnit:'mm',centerMM:request.center,radiusMM:request.radius,startQuadrant:circle?0:request.quadrant,spanCount:max,controlPointCount:count,parameterDomain:{min:0,max},endpointClosed:circle,periodic:false,regionCertified:false,solid:false});
  assert.equal(result.sourceVersion,0);assert.equal(result.model.version,0);assert.deepEqual(result.model.objects,[result.curve]);
  const recompiled=compileCadModel(result.source,{sourceVersion:0});assert.equal(recompiled.ok,true);assert.deepEqual(recompiled.model,result.model);
  assert.equal(result.curve.degree,2);assert.deepEqual(curveDomain(result.curve),[0,max]);
  assert.deepEqual(result.curve.weights,Array.from({length:count},(_,i)=>i%2?w:1));
  assert.deepEqual(result.curve.knots,circle?[0,0,0,1,1,2,2,3,3,4,4,4]:[0,0,0,1,1,1]);
  const relative=circle?[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]]:[[1,0],[1,1],[0,1]].map(p=>rotate(p,request.quadrant));
  assert.deepEqual(result.curve.controlPoints,relative.map(p=>[request.center[0]+request.radius*p[0],request.center[1]+request.radius*p[1],0]));
  for(let span=0;span<max;span++) for(let j=0;j<=16;j++) {
    const t=j/16,u=span+t,q=circle?span:request.quadrant,expected=analytic(request.center,request.radius,q,t),point=evaluateCurve(result.curve,u);
    close(point,expected.point,1e-9);assert.ok(Math.abs(Math.hypot(point[0]-request.center[0],point[1]-request.center[1])-request.radius)<=1e-9);
    if(t>0&&t<1)close(evaluateCurveD1(result.curve,u).derivative,expected.derivative,1e-8);
  }
  close(evaluateCurveD1(result.curve,0).derivative,analytic(request.center,request.radius,circle?0:request.quadrant,0).derivative,1e-8);
  close(evaluateCurveD1(result.curve,max).derivative,analytic(request.center,request.radius,circle?3:request.quadrant,1).derivative,1e-8);
  for(let knot=1;knot<max;knot++)assert.throws(()=>evaluateCurveD1(result.curve,knot));
  assert.throws(()=>evaluateCurve(result.curve,-1));assert.throws(()=>evaluateCurve(result.curve,max+1));
  return result;
}
test('retained radius10 quarter coefficients and all CCW quadrants use original rational parameter',()=>{
  const source=readFileSync(new URL('../../../examples/cad-nurbs/quarter-circle.css',import.meta.url),'utf8');const retained=compileCadModel(source,{sourceVersion:0});assert.equal(retained.ok,true);
  const q=check({kind:'quarter-arc',id:'arc',center:[0,0],radius:10,quadrant:0});assert.deepEqual(q.curve,retained.model.objects[0]);close(evaluateCurve(q.curve,.5),[10/Math.sqrt(2),10/Math.sqrt(2),0]);
  assert.ok(Math.abs(evaluateCurve(q.curve,.25)[1]-10*Math.sin(Math.PI/8))>.1,'rational t is not linear angle');
  for(let quadrant=0;quadrant<4;quadrant++)check({kind:'quarter-arc',id:'translated',center:[4,-3],radius:10,quadrant});
});
test('four-span circle shares nine poles, original endpoints, and exact C0 D1 policy',()=>{
  const result=check({kind:'circle',id:'circle',center:[4,-3],radius:10});assert.deepEqual(evaluateCurve(result.curve,0),[14,-3,0]);assert.deepEqual(evaluateCurve(result.curve,4),[14,-3,0]);
  for(let q=0;q<4;q++) {const expected=rotate([10/Math.sqrt(2),10/Math.sqrt(2)],q);close(evaluateCurve(result.curve,q+.5),[4+expected[0],-3+expected[1],0]);}
  const edited=check({kind:'circle',id:'circle',center:[4,-3],radius:12});assert.equal(edited.curve.id,result.curve.id);assert.deepEqual(evaluateCurve(edited.curve,0),[16,-3,0]);assert.notDeepEqual(result.curve,edited.curve);
});
test('radius and computed-pole coordinate bounds remain exact ordinary binary64',()=>{
  check({kind:'circle',id:'min',center:[0,0],radius:.001});check({kind:'circle',id:'max',center:[0,0],radius:10000});
  check({kind:'quarter-arc',id:'corner',center:[9999,9999],radius:1,quadrant:0});
  for(const radius of [0,-1,.0009999999999999998,10000.000000000002,NaN,Infinity,-Infinity])assert.throws(()=>buildXYArc({kind:'circle',id:'bad',center:[0,0],radius}));
  assert.throws(()=>buildXYArc({kind:'circle',id:'bounds',center:[9999,0],radius:2}));
  assert.throws(()=>buildXYArc({kind:'quarter-arc',id:'bounds',center:[-9999,-9999],radius:2,quadrant:2}));
});
test('center/radius bits and decimal-only actual poles survive signedzero, subnormal and precision sources',()=>{
  for(const center of [[-0,-0],[5e-324,-5e-324],[1e-7,-1e-7],[.12345678901234567,-.12345678901234567]]) {
    const request={kind:'circle',id:'tiny',center,radius:.001};const result=buildXYArc(request);
    assert.ok(Object.is(result.report.centerMM[0],center[0]));assert.ok(Object.is(result.report.centerMM[1],center[1]));assert.ok(Object.is(result.report.radiusMM,request.radius));
    const actual=compileCadModel(result.source,{sourceVersion:0});assert.equal(actual.ok,true);assert.deepEqual(actual.model,result.model);assert.doesNotMatch(result.source,/\d[eE][+-]?\d/);
  }
});
test('strict shape/fields/ranks/IDs/angles/planes/quadrants reject without altering valid prior output',()=>{
  const good={kind:'quarter-arc',id:'arc',center:[0,0],radius:1,quadrant:0},prior=buildXYArc(good);
  const bad=[null,[],{}, {...good,kind:'arc'},{...good,id:''},{...good,id:'a'.repeat(129)},{...good,id:'é'}, {...good,center:[0]}, {...good,center:[0,0,0]}, {...good,center:[NaN,0]},{...good,center:[10000.1,0]},
    ...[-1,4,.5,NaN,Infinity,'0'].map(quadrant=>({...good,quadrant})),
    {...good,orientation:'clockwise'},{...good,plane:'xz'},{...good,startAngle:0},{...good,endAngle:90},{...good,unit:'cm'},
    {kind:'circle',id:'circle',center:[0,0],radius:1,quadrant:0}, {kind:'circle',id:'circle',center:[0,0],radius:1,proof:{valid:true}},
  ];for(const request of bad)assert.throws(()=>buildXYArc(request));assert.deepEqual(buildXYArc(good),prior);
  assert.equal(buildXYArc({...good,id:'a'.repeat(128)}).curve.id.length,128);
});
test('own-data snapshot rejects getters before execution and all malformed container forms',()=>{
  const good={kind:'circle',id:'circle',center:[0,0],radius:1};let calls=0;
  for(const key of Object.keys(good)){const input={...good};Object.defineProperty(input,key,{enumerable:true,get(){calls++;return good[key];}});assert.throws(()=>buildXYArc(input));}
  const nested={...good,center:[0,0]};Object.defineProperty(nested.center,'0',{enumerable:true,get(){calls++;return 0;}});assert.throws(()=>buildXYArc(nested));assert.equal(calls,0);
  for(const input of [{...good,[Symbol('foreign')]:1},Object.assign(Object.create({foreign:1}),good),Object.create(good),{...good,center:new Array(2)},{...good,center:{0:0,1:0,length:2}},{...good,center:Array(65).fill(0)},{...good,center:[[[[[0]]]],0]}])assert.throws(()=>buildXYArc(input));
  const hidden={...good};Object.defineProperty(hidden,'foreign',{value:0});assert.throws(()=>buildXYArc(hidden));
  const extra={...good,center:[0,0]};extra.center.foreign=1;assert.throws(()=>buildXYArc(extra));
  const cyclic={...good};cyclic.center=[cyclic,cyclic];assert.throws(()=>buildXYArc(cyclic));
  const nullProto=Object.assign(Object.create(null),good);assert.equal(buildXYArc(nullProto).curve.id,'circle');
});
function collect(value,set) {if(value&&typeof value==='object'){set.add(value);for(const item of Object.values(value))collect(item,set);}}
function uniqueOccurrences(value,seen,input) {if(value&&typeof value==='object'){assert.ok(!input.has(value),'output aliases input');assert.ok(!seen.has(value),'nested output occurrences alias');seen.add(value);for(const item of Object.values(value))uniqueOccurrences(item,seen,input);}}
test('every returned nested occurrence owns data independently of frozen caller and other compilations',()=>{
  const request=Object.freeze({kind:'circle',id:'circle',center:Object.freeze([-0,0]),radius:10});const result=buildXYArc(request),inputs=new WeakSet();collect(request,inputs);uniqueOccurrences(result,new WeakSet(),inputs);
  const prior=new WeakSet();collect(result,prior);uniqueOccurrences(buildXYArc(request),new WeakSet(),prior);
  assert.notEqual(result.curve.controlPoints[0],result.curve.controlPoints[8]);
  const before=structuredClone(result.model);try{result.curve.controlPoints[0][0]=999;}catch{}assert.deepEqual(result.model,before);
  const priorCenter=[...request.center];try{result.report.centerMM[0]=123;}catch{}assert.deepEqual(request.center,priorCenter);
});
test('IGES remains general/open/nonperiodic and parent553 source/native bytes stay unchanged',()=>{
  const circle=buildXYArc({kind:'circle',id:'circle',center:[0,0],radius:10}),exported=exportIGES(circle.model,['circle']);
  const fields=exported.iges.split('\n').filter(l=>l[72]==='P').map(l=>l.slice(0,64)).join('').split(',').slice(0,7).map(Number);assert.deepEqual(fields,[126,8,2,0,0,0,0]);
  const line=buildXYProfile({kind:'line',id:'line',points:[[0,0],[120,0]]});assert.equal(line.source,'@model profile { version:0; length-unit:mm; @curve #line { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[120,0,0]]; weights:[1,1]; } }\n');
  assert.deepEqual(line.curve,{kind:'curve',id:'line',degree:1,knots:[0,0,1,1],controlPoints:[[0,0,0],[120,0,0]],weights:[1,1]});assert.equal(line.report.endpointClosed,false);assert.equal(line.report.regionCertified,false);assert.equal(line.report.solid,false);
  const path=buildXYProfile({kind:'polyline',id:'path',points:[[0,0],[3,0],[3,2],[-1,2]]});assert.equal(path.source,'@model profile { version:0; length-unit:mm; @curve #path { type:nurbs; degree:1; knots:[0,0,1,2,3,3]; control-points:[[0,0,0],[3,0,0],[3,2,0],[-1,2,0]]; weights:[1,1,1,1]; } }\n');
  const rectangle=buildXYProfile({kind:'rectangle',id:'rect',origin:[4,-3],width:7,height:5});assert.equal(rectangle.source,'@model profile { version:0; length-unit:mm; @curve #rect { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[4,-3,0],[11,-3,0],[11,2,0],[4,2,0],[4,-3,0]]; weights:[1,1,1,1,1]; } }\n');
});
