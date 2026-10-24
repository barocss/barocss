import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCadPart,cutPiece,cutList,cutListCsv, massPropertiesOf, checkOutput } from '../dist/index.js';
const D=features=>({format:'barocss-cad-part',version:1,units:'mm',parameters:{},features});
const rhs={kind:'rect-tube',width:40,height:40,wall:3,outerRadius:0},A=1600-1156;
const tube={kind:'round-tube',diameter:30,wall:2},Ar=Math.PI*(225-169);
const near=(g,w,label)=>assert.ok(Math.abs(g-w)<=1e-12*Math.max(1,Math.abs(w)),`${label}: ${g} vs ${w}`);
const volume=o=>massPropertiesOf(o, 7.85).volume;
const corner=(gap,more={})=>D([{id:'f',kind:'frame',points:[[600,0,0],[0,0,0],[0,0,600]],segments:[[0,1],[1,2]],section:rhs,corners:{default:'mitre',...(gap===undefined?{}:{gap}),...more}}]);
const tee=(section,corners,eccentric=0)=>D([{id:'f',kind:'frame',points:[[-200,0,0],[200,0,0],[0,eccentric,300],[0,eccentric,0]],segments:[[0,1],[2,3]],section,up:[0,0,1],corners}]);
const notch=(cutter,eccentric=0)=>tee(tube,{default:'none',tee:'cope',at:[{point:3,kind:'cope',notch:cutter}]},eccentric);

test('FRk5 mitre half-plane gaps: each actual cut and report moves g/2, A(L-g/(2cos45))',()=>{
 for(const g of [0,2,7]) {const s=evaluateCadPart(corner(g));for(const o of s.outputs){near(volume(o),A*(600-g/Math.SQRT2),'mitre gap volume');assert.equal(checkOutput(o).valid,true);const e=o.member.ends.find(e=>e.kind==='mitre');if(g)assert.equal(e.gapMM,g);}}
 const old=evaluateCadPart(corner(undefined)),zero=evaluateCadPart(corner(0));old.outputs.forEach((o,i)=>assert.deepEqual(o.brep,zero.outputs[i].brep));
});
test('FRk5 face-butt branch held g off through side; parameter/per-point override and cut CSV/grouping',()=>{
 const doc=tee(rhs,{default:'none',tee:'butt',gap:2}),s=evaluateCadPart(doc),o=s.outputs[1];near(volume(o),A*(300-20-2),'face butt gap');assert.equal(o.member.ends.find(e=>e.kind==='butt').gapMM,2);
 const p=cutPiece(o),csv=cutListCsv(cutList([p],{density:7.85}));assert.match(csv,/gap 2 mm/);
 const copy={...p,id:'different-gap',ends:p.ends.map(e=>e.gapMM?{...e,gapMM:3}:e)};assert.equal(cutList([p,copy],{density:7.85}).rows.length,2);
 const f=doc.features[0],override={...doc,parameters:{g:5},features:[{...f,corners:{...f.corners,at:[{point:3,kind:'butt',gap:{parameter:'g'}}]}}]};near(volume(evaluateCadPart(override).outputs[1]),A*(300-20-5),'parameter override');
});
// Independent 8-point Gauss quadrature over disk slices x=r sin(u). No generated Kernel geometry supplies the oracle.
const GL=[[.0198550717512319,.0506142681451881],[.1016667612931866,.1111905172266872],[.2372337950418355,.1568533229389436],[.4082826787521751,.1813418916891810],[.5917173212478249,.1813418916891810],[.7627662049581645,.1568533229389436],[.8983332387068134,.1111905172266872],[.9801449282487681,.0506142681451881]];
const diskSaw=(r,e,R)=>{let v=0;for(let j=0;j<64;j++)for(const [x,w]of GL){const u=-Math.PI/2+(j+x)*Math.PI/64;v+=w*Math.PI/64*2*r*r*Math.cos(u)**2*Math.sqrt(R*R-(r*Math.sin(u)+e)**2);}return v;};
test('FRk5 holesaw actual saddle and eccentric T: disk-minus-disk cutter oracle, metadata and typed undersize',()=>{
 for(const [ecc,offset] of [[0,0],[6,0],[6,3],[-6,3]]) {
  const s=evaluateCadPart(notch({kind:'holesaw',diameter:52,offset},ecc)),o=s.outputs[1],loss=diskSaw(15,ecc-offset,26)-diskSaw(13,ecc-offset,26);near(volume(o),Ar*300-loss,'holesaw volume');assert.equal(checkOutput(o).valid,true);const e=o.member.ends.find(e=>e.kind==='notch');assert.deepEqual(e.notch,{kind:'holesaw',diameterMM:52,offsetMM:offset});assert.equal(cutPiece(o).ends.find(e=>e.kind==='notch').notch.offsetMM,offset);assert.match(cutListCsv(cutList([cutPiece(o)],{density:7.85})),/holesaw diameter 52 mm offset/);
 }
 assert.throws(()=>evaluateCadPart(notch({kind:'holesaw',diameter:20})),/NOTCH_CUTTER/);
});
test('FRk5 V notch exact saw planes: loss h*A-cot(angle/2)*4(ro^3-ri^3)/3',()=>{
 for(const angle of [90,120]) {const h=20,k=1/Math.tan(angle*Math.PI/360),o=evaluateCadPart(notch({kind:'v',depth:h,angle})).outputs[1];near(volume(o),Ar*300-(h*Ar-k*4*(15**3-13**3)/3),'v volume');assert.equal(checkOutput(o).valid,true);assert.deepEqual(o.member.ends.find(e=>e.kind==='notch').notch,{kind:'v',depthMM:h,angleDegrees:angle});assert.match(cutListCsv(cutList([cutPiece(o)],{density:7.85})),/v depth 20 mm angle/);}
});
test('FRk5 typed positive-gap and cutter limits, tiny positive gap refuses contact bead',()=>{
 for(const g of [-1,1200,Infinity])assert.throws(()=>evaluateCadPart(corner(g)),/GAP_SIZE/);
 assert.throws(()=>evaluateCadPart(tee(tube,{tee:'cope',gap:1})),/GAP_SIZE/);
 const doc=notch({kind:'v',depth:20,angle:90});assert.throws(()=>evaluateCadPart({...doc,features:[{...doc.features[0],corners:{...doc.features[0].corners,gap:1}}]}),/NOTCH_CUTTER/);
 for(const cutter of [{kind:'v',depth:30,angle:90},{kind:'v',depth:20,angle:180},{kind:'holesaw',diameter:-1},{kind:'holesaw',diameter:Infinity}])assert.throws(()=>evaluateCadPart(notch(cutter)),/NOTCH_CUTTER/);
 const gapped=tee(rhs,{default:'none',tee:'butt',gap:1e-8});assert.throws(()=>evaluateCadPart({...gapped,features:[...gapped.features,{id:'bead',kind:'weld-bead',frame:'f',on:{member:1,end:'end'},leg:3}]}),/BEAD_SEAM_NOT_PLANAR/);
});

test('FRk5 scalar admission keeps gap/cutter typed context and rejects new-record extras/unfinished joints',()=>{
 for(const gap of [20000,'wrong',{parameter:'missing'}])assert.throws(()=>evaluateCadPart(corner(gap)),/GAP_SIZE/);
 assert.throws(()=>evaluateCadPart(corner(1,{default:'none'})),/GAP_SIZE/);
 assert.throws(()=>evaluateCadPart(tee(rhs,{default:'none',tee:'none',gap:1})),/GAP_SIZE/);
 const v=notch({kind:'v',depth:20,angle:90}),f=v.features[0];assert.throws(()=>evaluateCadPart({...v,features:[{...f,corners:{...f.corners,at:[{point:3,kind:'cope',notch:{kind:'v',depth:20,angle:90},extra:1}]}}]}),/NOTCH_CUTTER/);
 for(const cutter of [{kind:'holesaw',diameter:20000},{kind:'holesaw',diameter:{parameter:'missing'}},{kind:'v',depth:20,angle:'wrong'}])assert.throws(()=>evaluateCadPart(notch(cutter)),/NOTCH_CUTTER/);
});

test('FRk5 active gap checks the opposite zero-gap actual butt plane, not the uncut skeleton end',()=>{
 const f={id:'f',kind:'frame',points:[[0,0,-100],[0,0,100],[100,0,-100],[100,0,100],[0,0,0],[100,0,0]],segments:[[0,1],[2,3],[4,5]],section:rhs,corners:{default:'none',tee:'butt',at:[{point:4,kind:'butt',gap:70},{point:5,kind:'butt',gap:0}]}};
 assert.throws(()=>evaluateCadPart(D([f])),/GAP_SIZE/);
 const baseline={...f,corners:{...f.corners,at:[{point:4,kind:'butt',gap:0},{point:5,kind:'butt',gap:0}]}};near(volume(evaluateCadPart(D([baseline])).outputs[2]),A*60,'zero-gap actual span');
});
