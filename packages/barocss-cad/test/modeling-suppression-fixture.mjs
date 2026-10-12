import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { prove } from './modeling-intersection-fixture.mjs';
import { bounds } from './modeling-cardinal-split-fixture.mjs';
import { work as sharedWork, bodyHash } from './modeling-chamfer-split-fixture.mjs';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';
export { bodyHash };
export function work(snapshot,...args){sharedWork(snapshot,...args);deepFrozen(snapshot);}

export function configurableRail(cad) {
  const model=cad.model(),frontDistance=model.parameter('frontDistance',1),backDistance=model.parameter('backDistance',2),backY=model.parameter('backY',24);
  const blank=model.sketch.rectangle({width:32,height:24}).extrude(8);
  const front=blank.chamfer(blank.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),frontDistance,{name:'frontFinish'});
  const back=front.chamfer(front.edges({parallelTo:'x',at:{y:backY,z:'max'}}).one(),backDistance,{name:'backFinish'});
  const parts=back.split({axis:'x',at:16});
  return {build:()=>model.build({negative:parts.negative,positive:parts.positive})};
}

// These calls reject before evaluate/native geometry; they are admission controls, not added model evaluations.
export function proveSuppressionPreflight(snapshot,CadModelError) {
  const text=snapshot.save(),hash=bodyHash(snapshot),states={...snapshot.suppression};let getterCalls=0;
  const bad=[{frontFinish:true,missing:false},{frontFinish:true,backFinish:1},{frontFinish:true,backFinish:'false'},null,[],Object.create({frontFinish:true}),{get frontFinish(){getterCalls++;return true;}},Object.fromEntries([['__proto__',true]]),{frontFinish:true,[Symbol('hidden')]:false}];
  for(const edits of bad) {
    assert.throws(()=>snapshot.withSuppression(edits),e=>e instanceof CadModelError&&e.code==='INPUT'&&e.operation==='suppression');
    assert.equal(snapshot.save(),text);assert.equal(bodyHash(snapshot),hash);assert.deepEqual(snapshot.suppression,states);
  }
  assert.equal(getterCalls,0);return {refusedBeforeEvaluation:bad.length,originalSnapshotUnchanged:true,getterCalls};
}

export function proveFinishes(snapshot,frontSuppressed,backSuppressed,halfVolume) {
  assert.deepEqual(snapshot.suppression,{frontFinish:frontSuppressed,backFinish:backSuppressed});
  assert.deepEqual(Object.keys(snapshot.parameters).sort(),['backDistance','backY','frontDistance']);
  assert.equal(snapshot.parameters.frontDistance,1);assert.equal(snapshot.parameters.backDistance,2);assert.equal(snapshot.parameters.backY,24);
  const document=JSON.parse(snapshot.save());
  assert.deepEqual(Object.keys(document).sort(),['format','nodes','outputs','parameters','schema','units']);
  assert.equal(document.schema,1);assert.equal(snapshot.features.length,5);
  const original=snapshot.evidence[1].native.solid;prove(original,6144);
  let selected=original,volume=6144;const activeCaps=[],discardedCaps=[];
  const inherited=split=>{
    let count=0;
    for(const lineage of split.lineage.faces.filter(f=>f.parent&&f.output)) {
      const before=split.request.parent.request.assets.find(a=>a.sourceId===lineage.parent.sourceId&&a.face.options.faceId===lineage.parent.faceId);
      const after=split[lineage.side].solid.request.assets.find(a=>a.sourceId===lineage.output.sourceId&&a.face.options.faceId===lineage.output.faceId);
      assert.ok(before&&after);assert.equal(after.sourceId,before.sourceId);assert.equal(after.face.options.faceId,before.face.options.faceId);
      assert.equal(after.face.loop.id,before.face.loop.id);assert.deepEqual(after.face.plane,before.face.plane);
      for(const asset of [before,after])assert.deepEqual(asset.face.model.objects.find(o=>o.id===asset.face.plane.id),asset.face.plane);
      count++;
    }
    assert.ok(count>0);return count;
  };
  let candidateBindings=0;
  for(const [index,name,suppressed,removed] of [[2,'frontFinish',frontSuppressed,16],[3,'backFinish',backSuppressed,64]]) {
    const evidence=snapshot.evidence[index],native=evidence.native;
    assert.equal(evidence.kind,'chamfer');assert.deepEqual(evidence.configuration,{name,suppressed,output:suppressed?'parent':'chamfer-result'});
    assert.deepEqual(snapshot.features[index],{kind:'chamfer',index,dependencies:[index-1],name,suppressed});
    assert.equal(document.nodes[index].name,name);assert.equal(document.nodes[index].suppressed,suppressed);
    assert.deepEqual(Object.keys(document.nodes[index]).sort(),['distance','edge','kind','name','parent','suppressed']);
    assert.deepEqual(native.split.request.parent,selected); // Whole retained source/IDs/certificate, not just volume.
    prove(native.split.request.parent,volume);prove(native.split.negative.solid,volume-removed);prove(native.split.positive.solid,removed);
    assert.equal(native.split.report.volumeMM3.conserved,true);candidateBindings+=inherited(native.split);
    const caps=native.split.lineage.faces.filter(f=>f.side==='negative'&&f.role==='cap');assert.equal(caps.length,1);
    if(suppressed)discardedCaps.push(caps[0].output);else {activeCaps.push(caps[0].output);selected=native.split.negative.solid;volume-=removed;}
  }
  const split=snapshot.evidence[4].native;assert.deepEqual(split.request.parent,selected);prove(split.request.parent,2*halfVolume);assert.equal(volume,2*halfVolume);
  for(const cap of discardedCaps) {
    assert.ok(!split.request.parent.request.assets.some(a=>a.sourceId===cap.sourceId));
    assert.ok(!split.lineage.faces.some(f=>f.parent?.sourceId===cap.sourceId||f.output?.sourceId===cap.sourceId));
    for(const name of Object.keys(snapshot.bodies))assert.ok(!convexBody(snapshot,name).request.assets.some(a=>a.sourceId===cap.sourceId));
  }
  const outputBindings=inherited(split);
  for(const [side,min,max,sign] of [['negative',0,16,1n],['positive',16,32,-1n]]) {
    const body=convexBody(snapshot,side);assert.equal(body,split[side].solid);prove(body,halfVolume);bounds(body,0,min,max);bounds(body,1,0,24);bounds(body,2,0,8);
    for(const cap of activeCaps)assert.ok(split.lineage.faces.some(f=>f.side===side&&f.output&&f.parent?.sourceId===cap.sourceId&&f.parent?.faceId===cap.faceId));
    const cap=split.lineage.faces.find(f=>f.side===side&&f.role==='cap');assert.ok(cap&&!cap.parent);
    const support=body.supports.find(s=>s.sourceId===cap.output.sourceId&&s.faceId===cap.output.faceId);
    assert.ok(BigInt(support.outwardNormal[0].numerator)*sign>0n);assert.equal(BigInt(support.outwardNormal[1].numerator),0n);assert.equal(BigInt(support.outwardNormal[2].numerator),0n);
  }
  assert.equal(split.report.status,'split');assert.equal(split.report.volumeMM3.conserved,true);
  assert.equal(split.section.kind,'cycle');const capEdges=6-Number(frontSuppressed)-Number(backSuppressed);
  assert.equal(split.section.cycleNodeKeys.length,capEdges);assert.equal(split.lineage.capUses.length,capEdges);
  for(const pair of split.lineage.capUses) {
    const uses=['negative','positive'].map(side=>split.lineage.faces.find(f=>f.side===side&&f.role==='cap').edges.find(e=>e.useId===pair[side].useId));
    assert.deepEqual(uses[0].nodeKeys,[...uses[1].nodeKeys].reverse());
  }
  return {frontSuppressed,backSuppressed,parentMM3:volume,negativeMM3:halfVolume,positiveMM3:halfVolume,capEdges,validatedChamferCandidates:2,activeCaps:activeCaps.length,discardedCapsAbsent:discardedCaps.length,candidateBindings,outputBindings,exactSelectedParent:true};
}
