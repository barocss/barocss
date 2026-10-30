import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTrimmedSurfaceAtParameter, splitSurfaceAtParameter, TrimmedSurfaceParameterSplitError, evaluateCurve } from '../dist/index.js';

const support=()=>({kind:'surface',id:'support',degreeU:1,degreeV:1,knotsU:[-2,-2,6,6],knotsV:[1,1,7,7],controlPoints:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]],weights:[[1,1],[1,1]]});
const world=[[15,-1],[35,-1],[35,15],[29,15],[29,5],[21,5],[21,15],[15,15]];
const uv=world.map(([x,y])=>[(x-20)/5,(y+11)/5]);
const options=(axis='v',parameter=3.7)=>({axis,parameter,lowerSurfaceId:'lower',upperSurfaceId:'upper'});
const split=(keep='inside',points=uv,o=options(),s=support())=>splitTrimmedSurfaceAtParameter(s,[{keep,uv:points}],o);
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
// Independent Green formula over the returned stored world polygons, no CAD area/mass helper.
function material(component){let area2=0,mx=0,my=0;for(const loop of component.trimLoops){
  const p=loop.uv.map(([u,v])=>[20+5*u,-11+5*v]);
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],z=a[0]*b[1]-b[0]*a[1];area2+=z;mx+=(a[0]+b[0])*z;my+=(a[1]+b[1])*z;}
}return {area:area2/2,centroid:[mx/(3*area2),my/(3*area2),3]};}
function checkComponents(result,expected){assert.equal(result.components.length,expected.length);for(let i=0;i<expected.length;i++){
  const c=result.components[i],want=expected[i],m=material(c);assert.equal(c.side,want[0]);near(m.area,want[1]);m.centroid.forEach((v,k)=>near(v,want[2][k]));assert.equal(c.trimLoops[0].keep,'inside');assert.ok(c.trimLoops.slice(1).every(l=>l.keep==='outside'));
}assert.ok(result.trimSplit.maximumWorldBoundaryBound<=1e-7);assert.ok(result.trimSplit.maximumUVRoundingBound<=1e-7);}

test('trimmed Split: concave inside material has lower1 and upper2 independent components',()=>{
  const original=support(),mask=[{keep:'inside',uv:structuredClone(uv)}],before=structuredClone({original,mask}),parent=splitSurfaceAtParameter(original,options());
  const r=splitTrimmedSurfaceAtParameter(original,mask,options());checkComponents(r,[['lower',150,[25,2.85,3]],['upper',45,[18,11.25,3]],['upper',45,[32,11.25,3]]]);
  assert.deepEqual(r.report,parent.report);assert.equal(r.source,parent.source);assert.deepEqual(r.lower,parent.lower);assert.deepEqual(r.upper,parent.upper);assert.deepEqual({original,mask},before);
  assert.deepEqual(r.trimSplit.componentCounts,{lower:1,upper:2});assert.equal(r.trimSplit.usedChildren.lower.regularityCertified,true);assert.equal(r.trimSplit.usedChildren.upper.regularityCertified,true);
  assert.ok(r.trimSplit.usedChildren.lower.jacobianBernstein.every(c=>BigInt(c.numerator)>0n));
  const reversed=split('inside',[...uv].reverse());assert.deepEqual(reversed.components,r.components);
});
test('trimmed Split: outside hole crossing the cut retains an isolated lower pocket and upper material',()=>{
  const r=split('outside');checkComponents(r,[['lower',370,[1195/37,-59/148,3]],['lower',20,[25,6.25,3]],['upper',570,[585/19,1251/76,3]]]);
  assert.deepEqual(r.trimSplit.componentCounts,{lower:2,upper:1});near(r.components.map(material).reduce((s,m)=>s+m.area,0),960);
});
test('trimmed Split: a whole empty child has no components; uncut hole uses AND outer plus outside mask',()=>{
  const r=split('inside',uv,options('v',5.7));checkComponents(r,[['lower',240,[25,6,3]]]);assert.equal(r.trimSplit.usedChildren.upper,null);assert.equal(r.trimSplit.componentCounts.upper,0);
  const outside=split('outside',uv,options('v',5.7));assert.equal(outside.components.length,2);assert.ok(outside.components.some(c=>c.trimLoops.length===2));
});
test('trimmed Split: original public Curve160 samples remain a practical finite fractional profile',t=>{
  const controlPoints=[...world,world[0]].map(([x,y])=>[x,y,3]);
  const curve={kind:'curve',id:'loop',degree:1,knots:[0,0,1,2,3,4,5,6,7,8,8],controlPoints,weights:Array(9).fill(1)};
  const points=[];for(let i=0;i<160;i++){const [x,y]=evaluateCurve(curve,8*i/160);points.push([(x-20)/5,(y+11)/5]);}
  for(const keep of ['inside','outside']){const r=split(keep,points);assert.equal(r.trimSplit.inputPointCount,160);
    if(keep==='inside')checkComponents(r,[['lower',150,[25,2.85,3]],['upper',45,[18,11.25,3]],['upper',45,[32,11.25,3]]]);
    else checkComponents(r,[['lower',370,[1195/37,-59/148,3]],['lower',20,[25,6.25,3]],['upper',570,[585/19,1251/76,3]]]);
    assert.ok(r.trimSplit.work.arrangement.pairTests<=13530);assert.ok(r.trimSplit.work.bindingArithmetic.operations<=200000);t.diagnostic(JSON.stringify({keep,counts:r.trimSplit.work,componentCounts:r.trimSplit.componentCounts}));
  }
});
test('trimmed Split: both axes, cut vertices/coincident edges and boundary-touching whole masks',()=>{
  for(const parameter of [0.35,1.8]){const r=split('inside',uv,options('u',parameter));near(r.components.map(material).reduce((s,m)=>s+m.area,0),240);assert.ok(r.components.some(c=>c.side==='lower'));assert.ok(r.components.some(c=>c.side==='upper'));}
  const rectangle=[[-2,1],[6,1],[6,7],[-2,7]];const whole=split('inside',rectangle,options('u',0.4));near(whole.components.map(material).reduce((s,m)=>s+m.area,0),1200);
  const edge=split('inside',uv,options('v',3.2));near(edge.components.map(material).reduce((s,m)=>s+m.area,0),240);
});
test('trimmed Split: native collapsed used children refuse, unused collapse is allowed, and representable thin/nonaffine children pass',()=>{
  const high={...support(),knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]};
  const hole=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]];
  for(const parameter of [1e-16,Number.MIN_VALUE]){
    const o=options('u',parameter),native=splitSurfaceAtParameter(high,o);assert.deepEqual(native.lower.controlPoints[0],native.lower.controlPoints[1]);
    assert.throws(()=>split('outside',hole,o,high),e=>e instanceof TrimmedSurfaceParameterSplitError&&e.code==='BINDING'&&/Jacobian/.test(e.message));
    const unused=split('inside',hole,o,high);assert.equal(unused.trimSplit.usedChildren.lower,null);assert.ok(unused.components.every(c=>c.side==='upper'));
  }
  const thin=split('outside',hole,options('u',1e-10),high);assert.equal(thin.trimSplit.usedChildren.lower.regularityCertified,true);
  const slanted={...support(),controlPoints:[[[0,0,0],[0,1,1]],[[1,0,1],[1,1,2]]]};
  const r=split('inside',uv,options('u',.4),slanted);assert.ok(r.components.length>1);assert.equal(r.trimSplit.usedChildren.lower.regularityCertified,true);assert.equal(r.trimSplit.usedChildren.upper.regularityCertified,true);
  assert.notEqual(r.lower.controlPoints[1][1][2]-r.lower.controlPoints[1][0][2]-r.lower.controlPoints[0][1][2]+r.lower.controlPoints[0][0][2],0);
});
test('trimmed Split: own simple-loop/profile admission refuses atomically and output masks do not alias',()=>{
  const source=support(),before=structuredClone(source);
  for(const mask of [[],[{keep:'inside',uv},{keep:'outside',uv}], [{keep:'inside',uv:[[0,2],[1,3],[0,3],[1,2]]}], [{keep:'inside',uv:[[0,2],[0,2],[1,3]]}], [{keep:'inside',uv:[[0,2],[7,2],[0,3]]}]])assert.throws(()=>splitTrimmedSurfaceAtParameter(source,mask,options()),TrimmedSurfaceParameterSplitError);
  let reads=0;const getter=[{keep:'inside',uv}];Object.defineProperty(getter[0],'uv',{get(){reads++;throw Error('getter invoked');}});assert.throws(()=>splitTrimmedSurfaceAtParameter(source,getter,options()),TrimmedSurfaceParameterSplitError);assert.equal(reads,0);
  const bad=support();bad.controlPoints[1][1][2]=1;assert.throws(()=>split('inside',uv,options(),bad),e=>e.code==='SUPPORT');
  const r=split();const other=structuredClone(r.components[1]);r.components[0].trimLoops[0].uv[0][0]=999;assert.deepEqual(r.components[1],other);assert.deepEqual(source,before);
});
test('trimmed Split: distinct exact cut intersections that round to one vertex refuse atomically, then a valid retry succeeds',()=>{
  const s={...support(),knotsU:[0,0,1,1],knotsV:[0,0,3,3],controlPoints:[[[0,0,0],[0,3,0]],[[1,0,0],[1,3,0]]]};
  const points=[[0,1],[1,2],[1,2+2**-51]],mask=[{keep:'inside',uv:points}],before=structuredClone({s,mask});
  // At U=.1 the two exact Y intersections differ by .1*2^-51, below one ulp near1.1.
  assert.throws(()=>splitTrimmedSurfaceAtParameter(s,mask,options('u',.1)),e=>e instanceof TrimmedSurfaceParameterSplitError&&e.code==='TOPOLOGY'&&/collapse/.test(e.message));
  assert.deepEqual({s,mask},before);
  const retry=split('inside',[[0,1],[1,2],[1,2.25]],options('u',.1),s);assert.equal(retry.components.length,2);assert.equal(retry.trimSplit.usedChildren.lower.regularityCertified,true);
});
