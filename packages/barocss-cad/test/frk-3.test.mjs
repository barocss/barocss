import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, lookupSection, sectionTableProblem, cutPiece, cutList, outputOf, massPropertiesOf, checkOutput, reevaluate } from '../dist/index.js';
import { prismOracle, sectionOracle } from './frk3-oracle.mjs';

const I = (height,width,web,flange,flangeSlope,rootRadius,toeRadius) => ({kind:'i-beam',height,width,web,flange,flangeSlope,rootRadius,toeRadius});
const CASES = [I(200,90,7,11,.14,9,4.5),I(160,74,6.3,9.5,.08,6,3),I(120,64,4.4,6.3,0,7,0),I(100,100,8,12,0,6,0),I(100,100,10,10,0,0,0),{kind:'channel',height:200,width:45,web:3.5,flange:11,flangeSlope:.14,rootRadius:9,toeRadius:4.5},{kind:'channel',height:80,width:40,web:5,flange:8,rootRadius:7}];
const D = (features,parameters={}) => ({format:'barocss-cad-part',version:1,units:'mm',parameters,features});
const member = (section,more={}) => ({id:'m',kind:'frame-member',section,start:[0,0,0],end:[0,0,1000],up:[0,1,0],...more});
const run = (section,more={}) => outputOf(evaluateCadPart(D([member(section,more)])), 'm');
const near = (g,w,label,tol=1e-12) => assert.ok(Math.abs(g-w)<=tol*Math.max(1,Math.abs(w)),`${label}: ${g} vs ${w}`);
const unit = a => {const l=Math.hypot(...a); return a.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function axes(start,end,up,roll=0) {
  const z=unit(end.map((x,i)=>x-start[i])), y0=unit(up.map((x,i)=>x-z[i]*dot(up,z))), x0=cross(y0,z), a=roll*Math.PI/180;
  return [x0.map((x,i)=>x*Math.cos(a)+y0[i]*Math.sin(a)), y0.map((x,i)=>x*Math.cos(a)-x0[i]*Math.sin(a)), z];
}
function check(section,more={}) {
  const start=more.start??[0,0,0], end=more.end??[0,0,1000], L=Math.hypot(...end.map((x,i)=>x-start[i])), rho=7.85;
  const want=prismOracle(section,L,rho), o=run(section,more), m=massPropertiesOf(o, rho), R=axes(start,end,more.up??[0,1,0],more.roll??0);
  near(o.member.area,want.A,'area'); want.c.forEach((x,i)=>near(o.member.centroid[i],i===0&&more.mirror?-x:x,'section centroid'));
  near(m.volume,want.volume,'volume'); near(m.mass,want.mass,'mass');
  // Default centroid anchor. Origin + offset and x mirror are checked independently.
  const anchor=more.anchor==='origin'?want.c:[0,0], offset=more.offset??[0,0], local=[(more.mirror?-1:1)*anchor[0]+offset[0],anchor[1]+offset[1],L/2];
  for(let i=0;i<3;i++) near(m.centroid[i],start[i]+dot(R.map(v=>v[i]),local),'world centroid');
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) {
    let v=0; for(let p=0;p<3;p++) for(let q=0;q<3;q++) v+=R[p][i]*want.inertia[p][q]*R[q][j];
    assert.ok(Math.abs(m.inertia[i][j]-v)<=1e-12*Math.max(...want.inertia.flat().map(Math.abs)),`I${i}${j}: ${m.inertia[i][j]} vs ${v}`);
  }
  assert.equal(o.bodyCount,1); assert.equal(checkOutput(o).valid,true); assert.equal(o.member.reversible,true);
  const doubled=massPropertiesOf(o, 2*rho); near(doubled.mass,2*m.mass,'density mass');
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) assert.ok(Math.abs(doubled.inertia[i][j]-2*m.inertia[i][j])<=1e-12*Math.max(...want.inertia.flat().map(Math.abs)),'density inertia');
  return o;
}

test('FRk3 independent triangle/sector moments: I/H and tapered/legacy channel matrix, all nine centroidal inertia entries',()=>{
  for(const section of CASES) check(section);
  near(sectionOracle(CASES[4]).A,2800,'independent sharp I rectangle area');
  near(sectionOracle(CASES[0]).A,2*sectionOracle(CASES[5]).A,'I and half-I channel');
});
test('FRk3 proper general rigid placement, roll, mirror, origin/centroid anchor, offset and reversed endpoints',()=>{
  const start=[17,-31,23], end=[317,129,223], up=[.2,-.1,1];
  for(const section of [CASES[0],CASES[5]]) for(const more of [{},{roll:37},{mirror:true,roll:-23},{anchor:'origin',offset:[7,-3],roll:19},{start:end,end:start,roll:11}]) check(section,{start,end,up,...more});
});
test('FRk3 legacy channel omitted equals explicit zero: geometry, labels, roles and cut-list grouping',()=>{
  const a=run(CASES[6]),b=run({...CASES[6],toeRadius:0,flangeSlope:0});
  assert.deepEqual(a.brep,b.brep); assert.deepEqual(a.member,b.member);
  assert.equal(cutList([cutPiece(a),{...cutPiece(b),id:'b'}],{density:7.85}).rows.length,1);
});
test('FRk3 I role contract survives zero arcs; rounded channel adds only toes',()=>{
  const names=s=>new Set(run(s).brep.faces.map(f=>f.name.replace(/^m\./,'').replace(/#\d+$/,'')));
  const flat=['outer.bottom','outer.top','tip.bottom.right','tip.top.right','tip.top.left','tip.bottom.left','inside.bottom.right','inside.top.right','inside.top.left','inside.bottom.left','web.right','web.left','start','end'];
  assert.deepEqual([...names(CASES[4])].sort(),flat.sort());
  assert.deepEqual([...names(CASES[0])].sort(),[...flat,...['bottom.right','top.right','top.left','bottom.left'].flatMap(s=>[`root.${s}`,`toe.${s}`])].sort());
  const old=names(CASES[6]),rounded=names({...CASES[6],toeRadius:2,flangeSlope:.1});
  assert.deepEqual([...rounded].sort(),[...old,'toe.bottom','toe.top'].sort());
});
test('FRk3 parameters, re-edit, JSON fresh evaluation, table direct equivalence and strict whole table fields',()=>{
  const section={...CASES[0],flangeSlope:{parameter:'k'},toeRadius:{parameter:'r'}},doc=D([member(section)],{k:.14,r:4.5});
  const s=evaluateCadPart(doc), changed=reevaluate(s, { parameters: {k:.08,r:3} });
  near(outputOf(s, 'm').member.area,sectionOracle(CASES[0]).A,'parameter');
  near(outputOf(changed, 'm').member.area,sectionOracle({...CASES[0],flangeSlope:.08,toeRadius:3}).A,'re-edit');
  assert.deepEqual(outputOf(evaluateCadPart(JSON.parse(JSON.stringify(doc))), 'm').member,outputOf(s, 'm').member);
  for(const direct of [CASES[0],CASES[5],CASES[6]]) {
    const {kind,...dims}=direct,table={id:'synthetic-frk3',kind,estimate:true,rows:[{size:'test',...dims}]};
    assert.equal(sectionTableProblem(table),null); assert.deepEqual(lookupSection(table,'test').section??lookupSection(table,'test').spec,direct);
    near(massPropertiesOf(run({kind:'table',table,size:'test'}), 7.85).volume,massPropertiesOf(run(direct), 7.85).volume,'table volume');
    assert.match(sectionTableProblem({...table,rows:[{...table.rows[0],bogus:1}]}),/unknown field/);
    assert.throws(()=>run({kind:'table',table,size:'missing'}),/SECTION_TABLE_MISS/);
  }
});
test('FRk3 dimension refusals: negative slope, exhausted tip/web, tangent sum equality and both sides of fit boundary',()=>{
  const base=I(100,100,10,10,0,0,0),bad=s=>assert.throws(()=>run(s),e=>/\[SECTION_DIMENSIONS\]/.test(e.message));
  for(const kind of ['i-beam','channel']) for(const delta of [{flangeSlope:-.01},{flangeSlope:1},{rootRadius:80},{toeRadius:10},{web:100},{flange:50}]) bad({...base,kind,...delta});
  // I overhang 45. At 90-degree root/toe corners each consumes r; equality leaves no flat.
  check({...base,rootRadius:37,toeRadius:7.999});
  bad({...base,rootRadius:37,toeRadius:8}); bad({...base,rootRadius:37,toeRadius:8.001});
  for(const key of ['height','width','web','flange','rootRadius','toeRadius','flangeSlope']) {const s={...base};delete s[key];assert.throws(()=>run(s),e=>['INPUT','PARAMETER'].includes(e.code)||/SECTION_DIMENSIONS/.test(e.message));}
});

test('FRk3 I/channel flange-tip face butt lands on actual material; gap footprint refuses without fallback',()=>{
  const rail={kind:'rect-tube',width:4,height:4,wall:1,outerRadius:0};
  const corner=(section,offset)=>D([{id:'f',kind:'frame',points:[[0,0,0],[400,0,0],[400,300,0]],segments:[[0,1],[2,1]],section,anchor:'origin',overrides:[{member:1,section:rail,anchor:'centroid',offset:[0,offset]}],corners:{at:[{point:1,kind:'butt',through:0}]}}]);
  for(const section of [CASES[0],CASES[5]]) {
    const offset=section.kind==='i-beam'?98:198;
    const snap=evaluateCadPart(corner(section,offset)), o=snap.outputs[1];
    assert.equal(o.member.ends[1].kind,'butt'); assert.ok(checkOutput(o).valid);
    near(massPropertiesOf(o).volume,12*(300-section.width/(section.kind==='i-beam'?2:1)),'flange-tip landing volume');
    assert.throws(()=>evaluateCadPart(corner(section,section.kind==='i-beam'?0:100)),/BUTT_ON_OPEN_SIDE/);
  }
});
