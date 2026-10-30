import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTrimmedSurfaceRegion, extractSurfaceRegion, TrimmedSurfaceRegionError, evaluateCurve } from '../dist/index.js';
import { regionOracle, exactlyAffinePoles } from './helpers/trim-region-oracle.mjs';

const support=()=>({kind:'surface',id:'support',degreeU:1,degreeV:1,knotsU:[-2,-2,6,6],knotsV:[1,1,7,7],controlPoints:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]],weights:[[1,1],[1,1]]});
const world=[[15,-1],[35,-1],[35,15],[29,15],[29,5],[21,5],[21,15],[15,15]],uv=world.map(([x,y])=>[(x-20)/5,(y+11)/5]);
const options=(u=[-1.6,5],v=[1.4,3.7])=>({surfaceId:'region',uInterval:u,vInterval:v,resultIdPrefix:'rg'});
const extract=(keep='inside',points=uv,o=options(),s=support())=>extractTrimmedSurfaceRegion(s,[{keep,uv:points}],o);
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
function material(component){let a2=0,mx=0,my=0;for(const loop of component.trimLoops){const p=loop.uv.map(([u,v])=>[20+5*u,-11+5*v]);for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],z=a[0]*b[1]-b[0]*a[1];a2+=z;mx+=(a[0]+b[0])*z;my+=(a[1]+b[1])*z;}}return {area:a2/2,centroid:[mx/(3*a2),my/(3*a2),3]};}
function checkOracle(result,points,keep,o,domain={u:[-2,6],v:[1,7]}){
  const expected=regionOracle(points,domain,{u:o.uInterval,v:o.vInterval},keep),actual=result.components.map(material);assert.equal(actual.length,expected.length);
  const used=new Set();
  for(const a of actual){const match=expected.findIndex((b,i)=>!used.has(i)&&Math.abs(a.area-b.area)<=1e-7&&a.centroid.every((v,k)=>Math.abs(v-b.centroid[k])<=1e-7));assert.ok(match>=0,JSON.stringify({actual:a,expected}));used.add(match);near(a.area,expected[match].area);for(let k=0;k<3;k++)near(a.centroid[k],expected[match].centroid[k]);}
  for(let i=0;i<result.components.length;i++){const c=result.components[i];assert.equal(c.surfaceId,result.surface.id);assert.equal(c.componentIndex,i);assert.equal(c.trimLoops[0].keep,'inside');assert.ok(c.trimLoops.slice(1).every(l=>l.keep==='outside'));}
  assert.ok(result.trimRegion.maximumWorldBoundaryBound<=1e-7);assert.ok(result.trimRegion.maximumUVRoundingBound<=1e-7);assert.equal(result.trimRegion.usedSupportProof.regularityCertified,true);return actual;
}
test('trimmed Region: four native boundaries preserve independent concave inside and outside pocket material',()=>{
  const source=support(),mask=[{keep:'inside',uv:structuredClone(uv)}],before=structuredClone({source,mask}),o=options(),parent=extractSurfaceRegion(source,o),r=extractTrimmedSurfaceRegion(source,mask,o);
  checkOracle(r,uv,'inside',o);assert.equal(r.components.length,1);near(material(r.components[0]).area,150);assert.deepEqual(r.report,parent.report);assert.equal(r.source,parent.source);assert.deepEqual(r.surface,parent.surface);assert.equal(r.report.operationCount,4);assert.deepEqual({source,mask},before);
  const outside=extract('outside');const components=checkOracle(outside,uv,'outside',o);assert.equal(components.length,2);near(components.reduce((s,c)=>s+c.area,0),229.5);assert.ok(components.some(c=>Math.abs(c.area-20)<1e-7));
  assert.deepEqual(extract('inside',[...uv].reverse()).components,r.components);
});
test('trimmed Region: two inside components, one outside and retained hole masks match an independent rectangle slab',()=>{
  const o=options([-.8,2.8],[3.7,5]);for(const keep of ['inside','outside']){const r=extract(keep,uv,o);const a=checkOracle(r,uv,keep,o);assert.equal(a.length,keep==='inside'?2:1);near(a.reduce((s,c)=>s+c.area,0),keep==='inside'?65:52);}
  const hole=extract('outside',uv,options([-1.6,5],[1.4,6.2]));checkOracle(hole,uv,'outside',options([-1.6,5],[1.4,6.2]));assert.equal(hole.components.length,1);assert.equal(hole.components[0].trimLoops.length,2);near(material(hole.components[0]).area,552);
});
test('trimmed Region: empty crop is typed DOMAIN and atomic; outside keeps an explicit whole rectangle and retry works',()=>{
  const o=options([.4,1.6],[3.8,4.6]),source=support(),mask=[{keep:'inside',uv:structuredClone(uv)}],before=structuredClone({source,mask});
  assert.throws(()=>extractTrimmedSurfaceRegion(source,mask,o),e=>e instanceof TrimmedSurfaceRegionError&&e.code==='DOMAIN'&&/no positive-area/.test(e.message));assert.deepEqual({source,mask},before);
  const outside=extract('outside',uv,o);checkOracle(outside,uv,'outside',o);assert.equal(outside.components.length,1);assert.equal(outside.components[0].trimLoops.length,1);near(material(outside.components[0]).area,24);
  assert.equal(extract('inside').components.length,1);
});
test('trimmed Region: full native copy preserves parent zero-operation report and owned source masks',()=>{
  const o=options([-2,6],[1,7]);for(const keep of ['inside','outside']){const r=extract(keep,uv,o);assert.equal(r.report.operationCount,0);assert.equal(r.provenance.fullDomainCopy,true);checkOracle(r,uv,keep,o);assert.deepEqual(r.trimRegion.originalMaterialAreaUV,r.trimRegion.croppedMaterialAreaUV);}
});
test('trimmed Region: public Curve160 samples admit ordinary fractional four-boundary crops',t=>{
  const curve={kind:'curve',id:'loop',degree:1,knots:[0,0,1,2,3,4,5,6,7,8,8],controlPoints:[...world,world[0]].map(([x,y])=>[x,y,3]),weights:Array(9).fill(1)},points=[];
  for(let i=0;i<160;i++){const p=evaluateCurve(curve,8*i/160);points.push([(p[0]-20)/5,(p[1]+11)/5]);}
  for(const keep of ['inside','outside']){const o=options(),r=extract(keep,points,o);checkOracle(r,points,keep,o);assert.equal(r.trimRegion.inputPointCount,160);t.diagnostic(JSON.stringify({keep,componentCount:r.trimRegion.componentCount,work:r.trimRegion.work}));}
});
test('trimmed Region: 160-point comb exceeds Split graph limits and fits exact rectangle capacities',t=>{
  const s={...support(),knotsU:[-3,-3,3,3],knotsV:[-1,-1,158,158],controlPoints:[[[5,-16,3],[5,779,3]],[[35,-16,3],[35,779,3]]]},points=[];
  for(let i=0;i<=156;i++)points.push([i%2===0?-1:2,i]);points.push([-2,156],[-2,78],[-2,0]);assert.equal(points.length,160);
  const o=options([0,1],[-.5,157]);
  for(const keep of ['inside','outside']){const r=extract(keep,points,o,s);checkOracle(r,points,keep,o,{u:[-3,3],v:[-1,158]});const c=r.trimRegion.work.arrangement;assert.equal(c.vertices,476);assert.equal(c.edges,788);assert.equal(r.components.length,keep==='inside'?78:79);if(keep==='inside')near(r.components.map(material).reduce((a,b)=>a+b.area,0),1950);t.diagnostic(JSON.stringify({keep,componentCount:r.components.length,work:r.trimRegion.work}));}
});
test('trimmed Region: boundary contacts, coincident edges and positive small material retain original masks',()=>{
  for(const o of [options([-1,3],[2,5.2]),options([-2,6],[1,3.2]),options([0,.0001],[2,2.0001])]){const r=extract('inside',uv,o);checkOracle(r,uv,'inside',o);assert.ok(r.components.map(material).reduce((a,b)=>a+b.area,0)>0);}
});
test('trimmed Region: generated rounded intersection collapse is typed TOPOLOGY with valid retry',()=>{
  const s={...support(),knotsU:[0,0,1,1],knotsV:[0,0,3,3],controlPoints:[[[0,0,0],[0,3,0]],[[1,0,0],[1,3,0]]]},points=[[0,1],[1,2],[1,2+2**-51]],o=options([0,.1],[0,3]),before=structuredClone({s,points});
  assert.throws(()=>extract('inside',points,o,s),e=>e instanceof TrimmedSurfaceRegionError&&e.code==='TOPOLOGY'&&/collapse/.test(e.message));assert.deepEqual({s,points},before);assert.equal(extract('inside',[[0,1],[1,2],[1,2.25]],o,s).components.length,1);
});
test('trimmed Region: ordinary nonaffine final native support is certified, parent refusal precedence remains',t=>{
  const s={...support(),controlPoints:[[[0,0,0],[0,1,1]],[[1,0,1],[1,1,2]]]},o=options([-.4,4.4],[1.4,5.8]),r=extract('inside',uv,o,s);assert.equal(r.trimRegion.usedSupportProof.regularityCertified,true);assert.ok(r.components.length>0);
  const nonaffine=extract('inside',uv,options([-2,.4],[1,7]),s);assert.equal(exactlyAffinePoles(nonaffine.surface.controlPoints),false);assert.equal(nonaffine.trimRegion.usedSupportProof.regularityCertified,true);
  const high={...support(),knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]},tiny=options([0,1e-16],[0,1]),hole=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]];
  let parentError;try{extractSurfaceRegion(high,tiny);}catch(e){parentError=e;}assert.ok(parentError);assert.throws(()=>extract('outside',hole,tiny,high),e=>e instanceof TrimmedSurfaceRegionError&&e.code==='NATIVE'&&e.cause?.message===parentError.message);
  t.diagnostic(JSON.stringify({ordinaryNonaffinePoles:nonaffine.surface.controlPoints,positionBound:nonaffine.trimRegion.maximumWorldBoundaryBound,parentCollapseRefusal:{name:parentError.name,code:parentError.code,message:parentError.message},newConsumerCode:'NATIVE'}));
});
test('trimmed Region: input/profile/range refusal is atomic and result components have independent arrays',()=>{
  const s=support(),before=structuredClone(s);for(const masks of [[],[{keep:'inside',uv},{keep:'outside',uv}],[{keep:'inside',uv:[[0,2],[1,3],[0,3],[1,2]]}],[{keep:'inside',uv:[[0,2],[0,2],[1,3]]}]])assert.throws(()=>extractTrimmedSurfaceRegion(s,masks,options()),TrimmedSurfaceRegionError);
  let reads=0;const mask=[{keep:'inside',uv}];Object.defineProperty(mask[0],'uv',{get(){reads++;throw Error('getter invoked');}});assert.throws(()=>extractTrimmedSurfaceRegion(s,mask,options()),e=>e instanceof TrimmedSurfaceRegionError&&e.code==='INPUT');assert.equal(reads,0);
  for(const o of [options([1,-1]),options([-3,5]),options([0,0])])assert.throws(()=>extract('inside',uv,o,s),e=>e instanceof TrimmedSurfaceRegionError&&e.code==='NATIVE');
  const bad=support();bad.controlPoints[1][1][2]=1;assert.throws(()=>extract('inside',uv,options(),bad),e=>e.code==='SUPPORT');
  const r=extract('inside',uv,options([-.8,2.8],[3.7,5])),other=structuredClone(r.components[1]);r.components[0].trimLoops[0].uv[0][0]=999;assert.deepEqual(r.components[1],other);assert.deepEqual(s,before);
});
