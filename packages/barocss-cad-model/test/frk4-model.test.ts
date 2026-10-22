import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, frameGeometry, frameSegmentCount, frameMemberIndices, leafBodies, bodyKey, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { toPartDocument, bodyKeyOf } from '../src/engine/part';
import { evaluatePart } from '../src/engine/evaluate';
import { weldList } from '../src/frames/welds';
const section={kind:'round-tube' as const,diameter:30,wall:2},area=Math.PI*(225-169);
const near=(g:number,w:number)=>assert.ok(Math.abs(g-w)<=1e-12*Math.max(1,Math.abs(w)),`${g} vs ${w}`);
const arc=():StudioDoc=>withNode({...emptyDoc(),parameters:{R:150}},{kind:'frame',points:[[{parameter:'R'},0,0],[0,{parameter:'R'},0]],segments:[{from:0,to:1,center:[0,0,0]}],section,up:[0,0,1]});
const bend=():StudioDoc=>withNode({...emptyDoc(),parameters:{R:100}},{kind:'frame',points:[[0,0,0],[300,0,0],[300,300,0],[0,0,500],[100,0,500]],segments:[[0,1],[1,2],[3,4]],bends:[{point:1,radius:{parameter:'R'}}],section,up:[0,0,1]});
async function bodies(doc:StudioDoc){const r=await evaluatePart(doc,1);assert.ok(r.ok,JSON.stringify(r));return r.bodies;}
test('FRk4 Model forwards authored arcs and parameterized bends with stable segment indices',()=>{
 const a=arc(),n=a.nodes[0];if(n.kind!=='frame')throw Error('frame');const g=frameGeometry(a.nodes,n,a.parameters);assert.ok('segments'in g);assert.deepEqual(g.segments,n.segments);const f=toPartDocument(a).features[0];if(f.kind!=='frame')throw Error('frame');assert.deepEqual(f.segments,n.segments);
 const through={...n,points:[...n.points,[100,100,0] as [number,number,number]],segments:[{from:0,to:1,through:2}]};assert.deepEqual((toPartDocument({...a,nodes:[through]}).features[0] as typeof f).segments,through.segments);
 const b=bend(),bn=b.nodes[0];if(bn.kind!=='frame')throw Error('frame');const bf=toPartDocument(b).features[0];if(bf.kind!=='frame')throw Error('frame');assert.deepEqual(bf.bends,bn.bends);assert.deepEqual(frameMemberIndices(bn),[0,2]);assert.equal(frameSegmentCount(b.nodes,bn),2);
});
test('FRk4 actual hollow arc report and Pappus survive JSON document/result',async()=>{
 const direct=arc(),n=direct.nodes[0];if(n.kind!=='frame')throw Error('frame');
 const through:StudioDoc={...direct,nodes:[{...n,points:[...n.points,[150/Math.sqrt(2),150/Math.sqrt(2),0]],segments:[{from:0,to:1,through:2}]}]};
 for(const doc of [direct,through,JSON.parse(JSON.stringify(direct)) as StudioDoc]) {
  const bs=await bodies(doc);assert.equal(bs.length,1);const b=bs[0],c=b.cutPiece?.curve;assert.ok(c);assert.equal(c.kind,'arc');near(c.radiusMM,150);near(c.angleDegrees,90);near(c.developedLengthMM,75*Math.PI);assert.deepEqual(c.segmentIndices,[0]);near(b.volumeMM3!,area*75*Math.PI);near(b.cutPiece!.axisLengthMM,75*Math.PI);assert.deepEqual(JSON.parse(JSON.stringify(b)).cutPiece.curve,c);
 }
});
test('FRk4 consumed bend retains member0/member2 body keys, selection and no interior weld',async()=>{
 const doc=bend(),bs=await bodies(doc);assert.deepEqual(bs.map(b=>b.key),['b0_part0','b0_part2']);const c=bs[0].cutPiece?.curve;assert.ok(c);assert.equal(c.kind,'bend');assert.deepEqual(c.segmentIndices,[0,1]);near(c.developedLengthMM,400+50*Math.PI);near(bs[0].volumeMM3!,area*(400+50*Math.PI));assert.equal(bodyKeyOf('n0/2',doc.nodes),'b0_part2');const moved=withNode(doc,{kind:'translate',parent:{node:0,side:'part2'},offset:[0,0,10]});assert.ok((await bodies(moved)).some(b=>b.key==='b1'));assert.equal(weldList(doc,bs).joints.length,0);
});
test('FRk4 immutable parameter edits change actual arc and bend geometry',async()=>{
 for(const doc of [arc(),bend()]) {const before=await bodies(doc),after=await bodies({...doc,parameters:{...doc.parameters,R:120}});assert.notEqual(before[0].volumeMM3,after[0].volumeMM3);near(after[0].cutPiece!.curve!.radiusMM,120);}
});
test('FRk4 straight skeleton followers preserve straight data and forward bends separately',()=>{
 const skeleton:ModelNode={kind:'skeleton',points:[[0,0,0],[300,0,0],[300,300,0]],segments:[[0,1],[1,2]]};const f:Extract<ModelNode,{kind:'frame'}>={kind:'frame',follows:{skeleton:0},points:[],segments:[],bends:[{point:1,radius:100}],section};const doc={...emptyDoc(),nodes:[skeleton,f]};assert.deepEqual(frameGeometry(doc.nodes,f),{points:skeleton.points,segments:skeleton.segments});assert.equal(frameSegmentCount(doc.nodes,f),1);const k=toPartDocument(doc).features[0];if(k.kind!=='frame')throw Error('frame');assert.deepEqual(k.bends,f.bends);assert.deepEqual(k.segments,skeleton.segments);
});
test('FRk4 Model preserves typed bend refusal without straight fallback',async()=>{const doc=bend(),r=await evaluatePart({...doc,parameters:{R:300}},1);assert.equal(r.ok,false);assert.match(JSON.stringify(r),/BEND_RADIUS/);});

test('FRk4 leaf bodies match sparse bend outputs and sole bend remains selectable as part0',async()=>{
 const sole=bend(),node=sole.nodes[0];if(node.kind!=='frame')throw Error('frame');sole.nodes=[{...node,points:node.points.slice(0,3),segments:node.segments.slice(0,2)}];
 for(const doc of [bend(),sole]) {
  const bs=await bodies(doc),refs=leafBodies(doc.nodes);assert.deepEqual(refs.map(r=>bodyKey(r,doc.nodes)),bs.map(b=>b.key));assert.equal(refs[0].side,'part0');assert.ok(!refs.some(r=>r.side==='part1'));
  const moved=withNode(doc,{kind:'translate',parent:refs[0],offset:[0,0,10]}),result=await bodies(moved);assert.ok(result.some(b=>b.key==='b1'));assert.ok(!leafBodies(moved.nodes).some(r=>r.node===0&&r.side==='part0'));
 }
 const single=withNode(emptyDoc(),{kind:'frame',points:[[0,0,0],[100,0,0]],segments:[[0,1]],section});assert.equal(leafBodies(single.nodes)[0].side,'solid');
 const double=withNode(emptyDoc(),{kind:'frame',points:[[0,0,0],[100,0,0],[0,0,100],[100,0,100]],segments:[[0,1],[2,3]],section});assert.deepEqual(leafBodies(double.nodes).map(r=>r.side),['part0','part1']);
});
