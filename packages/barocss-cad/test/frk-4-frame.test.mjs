import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCadPart,cutPiece,cutList} from '../dist/index.js';
const D=features=>({format:'barocss-cad-part',version:1,units:'mm',parameters:{},features});
const near=(g,w)=>assert.ok(Math.abs(g-w)<=1e-12*Math.max(1,Math.abs(w)),`${g} vs ${w}`);
const round={kind:'round-tube',diameter:30,wall:2},A=Math.PI*(225-169);
const rect={kind:'rect-tube',width:40,height:40,wall:3,outerRadius:6},Ar=1600-(4-Math.PI)*36-(1156-(4-Math.PI)*9);
const arc=(section,segment={from:0,to:1,center:[0,0,0]},more={})=>D([{id:'f',kind:'frame',points:[[150,0,0],[0,150,0],[150/Math.sqrt(2),150/Math.sqrt(2),0]],segments:[segment],section,up:[0,0,1],...more}]);
test('FRk4 named frame arcs: actual hollow one-body BRep, Pappus, analytic centroid, developed cut-list',()=>{
 for(const [section,area] of [[round,A],[rect,Ar]]) for(const segment of [{from:0,to:1,center:[0,0,0]},{from:0,to:1,through:2}]) {
  const o=evaluateCadPart(arc(section,segment)).outputs[0],m=o.massProperties(7850),curve=o.member.curve;
  near(m.volumeMM3,area*150*Math.PI/2); assert.equal(o.bodyCount,1);assert.equal(o.validate().valid,true);
  const roundedI=(w,h,r)=>w*h**3/12-4*((1-Math.PI/4)*r*r*(h/2-r)**2+(h/2-r)*r**3/3+r**4*(1/3-Math.PI/16));
  const J=section.kind==='round-tube'?Math.PI*(15**4-13**4)/4:roundedI(40,40,6)-roundedI(34,34,3), meanRadius=150+J/(area*150);
  near(m.centroidMM[0],2*meanRadius/Math.PI); near(m.centroidMM[1],2*meanRadius/Math.PI);near(m.centroidMM[2],0);
  near(curve.radiusMM,150);near(curve.angleDegrees,90);near(curve.developedLengthMM,150*Math.PI/2);
  const piece=cutPiece(o);near(piece.axisLengthMM,150*Math.PI/2);assert.equal(piece.fromVolume,false);near(cutList([piece],{densityKgPerM3:7850}).totals.axisLengthMM,150*Math.PI/2);
  curve.startTangent.forEach((x,i)=>near(x,[0,1,0][i]));curve.endTangent.forEach((x,i)=>near(x,[-1,0,0][i]));
 }
});
test('FRk4 tangent bend is one hollow body, legs shortened Rtan(theta/2), stable original segment refs',()=>{
 const doc=D([{id:'f',kind:'frame',points:[[0,0,0],[300,0,0],[300,300,0],[0,0,500],[100,0,500]],segments:[[0,1],[1,2],[3,4]],bends:[{point:1,radius:100}],section:round,up:[0,0,1]}]);
 const s=evaluateCadPart(doc),o=s.outputs[0],m=o.massProperties(7850),L=400+50*Math.PI;
 assert.equal(o.id,'f/0');assert.equal(s.outputs[1].id,'f/2');assert.deepEqual(o.member.curve.segmentIndices,[0,1]);
 near(m.volumeMM3,A*L);near(o.member.lengthMM,L);near(cutPiece(o).axisLengthMM,L);assert.equal(o.bodyCount,1);assert.equal(o.validate().valid,true);
 const selected=evaluateCadPart({...doc,features:[...doc.features,{id:'take',kind:'translate',target:'f/2',offset:[0,0,10]}]});assert.ok(selected.output('take'));
});
test('FRk4 typed arc/bend/butt refusal boundaries',()=>{
 assert.throws(()=>evaluateCadPart(arc(round,{from:0,to:1,center:[1,0,0]})),/ARC_MEMBER/);
 assert.throws(()=>evaluateCadPart(arc({...round,diameter:400,wall:2})),/ARC_MEMBER/);
 assert.throws(()=>evaluateCadPart(arc(round,undefined,{corners:{at:[{point:0,kind:'butt'}]}})),/BUTT_ON_CURVED_MEMBER/);
 const doc=D([{id:'f',kind:'frame',points:[[0,0,0],[100,0,0],[100,100,0]],segments:[[0,1],[1,2]],section:round,bends:[{point:1,radius:100}]}]);
 assert.throws(()=>evaluateCadPart(doc),/BEND_RADIUS/);
});

test('FRk4 actual angled curve-end mitre: extended circular material cut to a shared plane, valid BRep and actual mass',()=>{
 const doc=D([{id:'f',kind:'frame',points:[[150,0,0],[0,150,0],[-200,350,0]],segments:[{from:0,to:1,center:[0,0,0]},[1,2]],section:round,up:[0,0,1],corners:{default:'mitre'}}]);
 const s=evaluateCadPart(doc),curve=s.outputs[0],straight=s.outputs[1];
 for(const o of s.outputs) {assert.equal(o.validate().valid,true);assert.equal(o.bodyCount,1);assert.ok(o.massProperties(7850).volumeMM3>0);assert.equal(o.member.ends.filter(e=>e.kind==='mitre').length,1);}
 const a=curve.member.ends.find(e=>e.kind==='mitre'),b=straight.member.ends.find(e=>e.kind==='mitre');
 near(a.angleDegrees,22.5);near(b.angleDegrees,22.5);a.plane.normal.forEach((v,i)=>near(v,-b.plane.normal[i]));
 near(cutPiece(curve).ends[1].mitreDegrees,22.5);near(curve.member.curve.developedLengthMM,150*Math.PI/2);
 assert.ok(Math.abs(curve.massProperties(1).volumeMM3-A*150*Math.PI/2)>1,'cut mass uses actual clipped BRep');
});

test('FRk4 part document revolve forwards sketch holes and tags as an actual annular section',()=>{
 const o=evaluateCadPart(D([{id:'s',kind:'sketch',profile:'loop',segments:[{kind:'arc',start:[165,0],center:[150,0],direction:'ccw'}],holes:[[{kind:'arc',start:[163,0],center:[150,0],direction:'ccw'}]]},{id:'r',kind:'revolve',sketch:'s',axis:{origin:[0,0],direction:'y'},angleDegrees:90}])).output('r');
 near(o.massProperties(1).volumeMM3,A*150*Math.PI/2);assert.equal(o.bodyCount,1);assert.equal(o.validate().valid,true);
});
