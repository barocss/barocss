import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { deferMasses, evaluateDoc, forgetSnapshots, massOfRef } from '@barocss/cad-model/engine/evaluate';
import { nativeMassEnvelope, receiveNativeMass, receiveNativeMassPatch, type NativeMassSource } from '@barocss/cad-model/engine/nativeMassWire';
import { withMasses, type MassFields } from '../src/app/bodyResults';
import type { MassReply } from '../src/engine/engine.worker';
const source: NativeMassSource = {epoch:1,requestId:7,revision:3,slot:'evaluate'};
function fixture(){
 forgetSnapshots();deferMasses(true);
 try{
  const result=evaluateDoc(rectanglePart(17,23,5),source.revision);assert.ok(result.ok);const pending=result.bodies[0];assert.ok(pending.massRef!==undefined);
  const body=structuredClone(pending);assert.ok(receiveNativeMass(body,structuredClone(nativeMassEnvelope(source,pending)),source));
  // Explicit producer-field fixture isolates existing Worker/Studio forwarding from the separate native producer tests.
  const fields:MassFields={...massOfRef(pending.massRef)!,massMethod:'closed-form'};
  const envelope=structuredClone(nativeMassEnvelope(source,fields,pending.massRef));assert.ok(receiveNativeMassPatch(fields,pending.massRef,envelope,source));
  const reply:MassReply={masses:[{ref:pending.massRef,fields,nativeMass:envelope}]};
  return{body,fields,reply};
 }finally{deferMasses(false);}
}
test('authenticated deferred method fields reach Studio body patches without replacing mesh ownership',()=>{
 const f=fixture(),before=[f.body],patched=withMasses(before,new Map([[f.reply.masses[0].ref,f.reply.masses[0].fields]]));
 assert.notEqual(patched,before);assert.equal(patched[0].massMethod,'closed-form');assert.equal(patched[0].massRef,undefined);assert.equal(patched[0].mesh,f.body.mesh);
});
test('Studio refuses an already authenticated deferred patch after its method is tampered',()=>{
 const f=fixture(),before=[f.body];f.fields.massMethod='quadrature';
 assert.equal(withMasses(before,new Map([[f.reply.masses[0].ref,f.fields]])),before);
});
