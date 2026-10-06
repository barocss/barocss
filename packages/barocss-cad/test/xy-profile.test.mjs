import test from 'node:test';
import assert from 'node:assert/strict';
import { buildXYProfile, compileCadModel, evaluateCurve, evaluateCurveD1, validateCurve, exportIGES } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i])) <= 1e-10, `${actual} versus ${expected}`);
const fixtures = [
  [{kind:'line',id:'line',points:[[0,0],[120,0]]},[[0,0,0],[120,0,0]]],
  [{kind:'polyline',id:'path',points:[[0,0],[3,0],[3,2],[-1,2]]},[[0,0,0],[3,0,0],[3,2,0],[-1,2,0]]],
  [{kind:'rectangle',id:'rect',origin:[4,-3],width:7,height:5},[[4,-3,0],[11,-3,0],[11,2,0],[4,2,0],[4,-3,0]]],
];
function check(request,poles) {
  const result=buildXYProfile(request), n=poles.length;
  assert.deepEqual(result.curve,{kind:'curve',id:request.id,degree:1,knots:[0,...Array.from({length:n},(_,i)=>i),n-1],controlPoints:poles,weights:Array(n).fill(1)});
  assert.deepEqual(result.report,{kind:request.kind,plane:'xy',lengthUnit:'mm',vertexCount:n,segmentCount:n-1,parameterDomain:{min:0,max:n-1},endpointClosed:request.kind==='rectangle',regionCertified:false,solid:false});
  assert.equal(result.sourceVersion,0);assert.equal(result.model.name,'profile');assert.equal(result.model.version,0);assert.equal(result.model.lengthUnit,'mm');
  const compiled=compileCadModel(result.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,result.model);assert.deepEqual(result.model.objects,[result.curve]);
  validateCurve(result.curve);
  for(let i=0;i<n-1;i++) for(const t of [0,.125,.5,.875,1]) {
    close(evaluateCurve(result.curve,i+t),poles[i].map((v,k)=>v+t*(poles[i+1][k]-v)));
    if(t>0&&t<1) close(evaluateCurveD1(result.curve,i+t).derivative,poles[i+1].map((v,k)=>v-poles[i][k]));
  }
  close(evaluateCurveD1(result.curve,0).derivative,poles[1].map((v,k)=>v-poles[0][k]));
  close(evaluateCurveD1(result.curve,n-1).derivative,poles[n-1].map((v,k)=>v-poles[n-2][k]));
  for(let knot=1;knot<n-1;knot++) assert.throws(()=>evaluateCurveD1(result.curve,knot));
  return result;
}
test('three profiles retain exact original source/native structure and independent piecewise point/D1 formula',()=>{
  fixtures.forEach(([request,poles])=>check(request,poles));
});
test('64 vertices retain all linear spans; crossing open polylines stay uncertified',()=>{
  const points=Array.from({length:64},(_,i)=>[i,i%2]);const maximum=check({kind:'polyline',id:'max',points},points.map(p=>[...p,0]));
  assert.ok(Buffer.byteLength(maximum.source)<256*1024);console.log(JSON.stringify({profileMaxVertices:64,sourceBytes:Buffer.byteLength(maximum.source)}));
  check({kind:'polyline',id:'cross',points:[[0,0],[2,2],[0,2],[2,0]]},[[0,0,0],[2,2,0],[0,2,0],[2,0,0]]);
  assert.throws(()=>buildXYProfile({kind:'polyline',id:'too_many',points:[...points,[64,0]]}));
});
test('plain source literals round-trip signed zero, subnormal, scientific-form and full precision binary64',()=>{
  for(const x of [-0,5e-324,1e-7,0.12345678901234567,9999.999999999998]) {
    const result=buildXYProfile({kind:'line',id:'tiny',points:[[x,-0],[x<9000?1:9000,1]]});
    const compiled=compileCadModel(result.source,{sourceVersion:0});assert.equal(compiled.ok,true);
    assert.ok(Object.is(compiled.model.objects[0].controlPoints[0][0],x));assert.ok(Object.is(compiled.model.objects[0].controlPoints[0][1],-0));
    assert.doesNotMatch(result.source, /\d[eE][+-]?\d/);
  }
});
test('actual segment threshold and rectangle IEEE corners use no tolerance or rounding repair',()=>{
  check({kind:'line',id:'min',points:[[0,0],[.001,0]]},[[0,0,0],[.001,0,0]]);
  check({kind:'rectangle',id:'small',origin:[0,0],width:.001,height:.001},[[0,0,0],[.001,0,0],[.001,.001,0],[0,.001,0],[0,0,0]]);
  assert.throws(()=>buildXYProfile({kind:'line',id:'short',points:[[0,0],[.0009999999999999998,0]]}));
  // The requested width is legal; the actual rounded displacement at x=10 is shorter.
  assert.ok((10+.001)-10<.001);
  assert.throws(()=>buildXYProfile({kind:'rectangle',id:'rounded',origin:[10,0],width:.001,height:1}));
  const result=buildXYProfile({kind:'rectangle',id:'bounds',origin:[-10000,-10000],width:10000,height:10000});
  assert.deepEqual(result.curve.controlPoints,[[-10000,-10000,0],[0,-10000,0],[0,0,0],[-10000,0,0],[-10000,-10000,0]]);
});
test('all coordinate, family, rank, closure and identifier failures reject pure invalid updates',()=>{
  const good={kind:'line',id:'valid',points:[[0,0],[1,0]]};const stable=buildXYProfile(good);
  const bad=[null,[],{}, {...good,kind:'circle'},{...good,id:''},{...good,id:'a'.repeat(129)},{...good,id:'not ascii é'},
    {...good,points:[[0],[1,0]]},{...good,points:[[0,0,0],[1,0]]},{...good,points:[[0,0]]},{...good,points:[[0,0],[1,0],[2,0]]},
    ...[NaN,Infinity,-Infinity,10000.000000000002,-10000.000000000002].map(x=>({...good,points:[[x,0],[0,1]]})),
    {...good,points:[[0,0],[0,0]]},{kind:'polyline',id:'closed',points:[[0,0],[1,0],[0,0]]},
    ...[0,-1,.0009,10000.1,NaN,Infinity].map(width=>({kind:'rectangle',id:'bad',origin:[0,0],width,height:1})),
    {kind:'rectangle',id:'corner',origin:[9999,0],width:2,height:1}, {...good,unit:'cm'}, {...good,target:'iges'},
  ];
  for(const request of bad) assert.throws(()=>buildXYProfile(request));
  assert.deepEqual(buildXYProfile(good),stable);
  assert.equal(buildXYProfile({...good,id:'a'.repeat(128)}).curve.id.length,128);
});
test('strict own data rejects accessors without executing them, symbols/prototypes/sparse/extra arrays/cycles',()=>{
  const good={kind:'line',id:'valid',points:[[0,0],[1,0]]};let calls=0;
  for(const key of ['kind','id','points']) {const request={...good};Object.defineProperty(request,key,{enumerable:true,get(){calls++;return good[key];}});assert.throws(()=>buildXYProfile(request));}
  const nested={...good,points:[[0,0],[1,0]]};Object.defineProperty(nested.points[0],'0',{enumerable:true,get(){calls++;return 0;}});assert.throws(()=>buildXYProfile(nested));assert.equal(calls,0);
  const symbol={...good,[Symbol('foreign')]:1};assert.throws(()=>buildXYProfile(symbol));
  const hidden={...good};Object.defineProperty(hidden,'foreign',{value:1});assert.throws(()=>buildXYProfile(hidden));
  assert.throws(()=>buildXYProfile(Object.assign(Object.create({foreign:1}),good)));
  assert.throws(()=>buildXYProfile(Object.create(good)));
  const sparse={...good,points:[[0,0],new Array(2)]};assert.throws(()=>buildXYProfile(sparse));
  const extra={...good,points:[[0,0],[1,0]]};extra.points.extra=1;assert.throws(()=>buildXYProfile(extra));
  const fake={...good,points:{0:[0,0],1:[1,0],length:2}};assert.throws(()=>buildXYProfile(fake));
  const cycle={...good};cycle.points=[cycle,cycle];assert.throws(()=>buildXYProfile(cycle));
  const deep={...good,points:[[[[[0]]]],[[1,0]]]};assert.throws(()=>buildXYProfile(deep));
  const huge={...good,points:Array.from({length:1025},()=>[0,0])};assert.throws(()=>buildXYProfile(huge));
});
test('frozen and aliased inputs preserve caller state; result branches and repeated rectangle endpoint own arrays',()=>{
  const p=Object.freeze([-0,0]),q=Object.freeze([1,0]);const input=Object.freeze({kind:'polyline',id:'frozen',points:Object.freeze([p,q,p,Object.freeze([0,1])])});
  const result=buildXYProfile(input);assert.ok(Object.is(result.curve.controlPoints[0][0],-0));
  assert.notEqual(result.curve,result.model.objects[0]);assert.notEqual(result.curve.controlPoints,result.model.objects[0].controlPoints);
  assert.notEqual(result.curve.controlPoints[0],result.curve.controlPoints[2]);assert.notEqual(result.curve.controlPoints[0],p);
  const rectangle=buildXYProfile(fixtures[2][0]);assert.notEqual(rectangle.curve.controlPoints[0],rectangle.curve.controlPoints[4]);
  const before=structuredClone(rectangle);try {rectangle.curve.controlPoints[0][0]=20;}catch{}
  assert.deepEqual(rectangle.model,before.model);assert.deepEqual(buildXYProfile(fixtures[2][0]),before);
});
test('native math outside builder limits and original IGES general/open/nonperiodic flags remain unchanged',()=>{
  const native={kind:'curve',id:'outside',degree:1,knots:[0,0,1,1],controlPoints:[[20000,0,0],[20001,0,0]],weights:[1,1]};validateCurve(native);close(evaluateCurve(native,.5),[20000.5,0,0]);
  const rectangle=buildXYProfile(fixtures[2][0]);const exported=exportIGES(rectangle.model,['rect']);
  assert.equal(exported.report.objects[0].entity,126);
  const params=exported.iges.split('\n').filter(line=>line[72]==='P').map(line=>line.slice(0,64)).join('').split(',');
  assert.deepEqual(params.slice(0,7).map(Number),[126,4,1,0,0,1,0]);
});
test('existing source0/1/2 compiler contracts remain separate from profile requests',()=>{
  const curve='@curve #c {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}';
  const zero=compileCadModel(`@model parent {version:0;length-unit:mm;${curve}}`,{sourceVersion:0});assert.equal(zero.ok,true);assert.equal(zero.ir.schemaVersion,1);
  const one=compileCadModel(`@model parent {version:1;length-unit:mm;${curve}@extrude #wall {curve:#c;vector:[0,0,2];}}`,{sourceVersion:1});assert.equal(one.ok,true);assert.equal(one.ir.schemaVersion,1);assert.deepEqual(one.constructions[0].vector,[0,0,2]);
  const two=compileCadModel(`@model parent {version:2;length-unit:mm;@parameter #width {type:length;value:1cm;}${curve.replace('[1,0,0]','[$width,0,0]')}}`,{sourceVersion:2});assert.equal(two.ok,true);assert.equal(two.ir.schemaVersion,2);assert.equal(two.model.objects[0].controlPoints[1][0],10);
  const input=Object.assign(Object.create(null),{kind:'line',id:'null_proto',points:[[0,0],[1,0]]});assert.equal(buildXYProfile(input).curve.id,'null_proto');
});
