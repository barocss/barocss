import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { part as cadPart, BarocssError, type MassResult } from '@barocss/cad/api';
import { evaluateCadPart, massPropertiesOf, brepMassProperties, type CadPartDocument } from '@barocss/cad';
import { part as modelPart } from '../src/api/index';
import { massOf as modelMass } from '../src/api/core';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, forgetSnapshots, deferMasses, massOfRef, nativeMassPropertiesOfBody, placeBody, placedMassFields, volumeBasisOf, type BodyResult } from '../src/engine/evaluate';
import { MeshSender, MeshReceiver } from '../src/engine/meshWire';
import { nativeMassEnvelope, receiveNativeMass, receiveNativeMassPatch, matchesNativeMassPatch, type NativeMassSource } from '../src/engine/nativeMassWire';
const { massTranslationSphereStep } = await import(resolve(import.meta.dirname, '../../barocss-cad/test/brep-mass-translation-fixtures.mjs')) as { massTranslationSphereStep(options?: { radius?: number; center?: number[]; compound?: boolean }): string };
type Method = 'closed-form' | 'planar-exact' | 'quadrature' | 'tessellated';
type ProvenanceBody = BodyResult & { massMethod?: Method };
const source: NativeMassSource = { epoch: 3, requestId: 17, revision: 7, slot: 'evaluate' };
const density = 2.7, identity = [1,0,0,0,1,0,0,0,1], translation = [11,22,33];
const sphereText = massTranslationSphereStep({ radius: 4, center: [0,0,0], compound: false });
const positions = [0,0,0,1,0,0,0,1,0,0,0,1], indices = [0,2,1,0,1,3,0,3,2,1,2,3];
const sphereModel = (): StudioDoc => withNode(emptyDoc(), { kind: 'import', name: 'native sphere', step: sphereText, solids: 1 });
const facetModel = (): StudioDoc => withNode(emptyDoc(), { kind: 'mesh', name: 'facet tetrahedron', unit: 'mm', representation: 'facets', positions, indices });
const cadDoc = (kind: 'import' | 'mesh'): CadPartDocument => ({ format:'barocss-cad-part',version:1,units:'mm',parameters:{},features:[kind === 'import' ? {id:'shape',kind,step:sphereText} : {id:'shape',kind,representation:'facets',positions,indices}] });
const bodyOf = (doc = rectanglePart(10,20,30)): ProvenanceBody => { const r = evaluateDoc(doc, source.revision); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies[0]; };
const numbers = (m: {volume:number|null;mass:number|null;centroid?:readonly number[];inertia?:readonly (readonly number[])[]}) => ({volume:m.volume,mass:m.mass,centroid:m.centroid,inertia:m.inertia});
const close = (a:number,b:number) => assert.ok(Math.abs(a-b) <= 1e-9*Math.max(1,Math.abs(b)), `${a} != ${b}`);

for (const facade of ['CAD','Model'] as const) test(`${facade} declared public box reports native closed-form without changing MMGS numbers`, () => {
  const p = facade === 'CAD' ? cadPart().box({w:10,d:20,h:30}) : modelPart().box({w:10,d:20,h:30});
  const before = structuredClone(p.doc);
  const native = facade === 'CAD' ? massPropertiesOf(evaluateCadPart(p.doc as CadPartDocument).outputs[0],density) : nativeMassPropertiesOfBody(bodyOf(p.doc as StudioDoc));
  assert.ok(native);assert.equal(native.method,'closed-form','establish the actual native provider before testing facade metadata');
  const actual = p.mass({density});
  assert.equal(actual.method,native.method); assert.equal(Object.hasOwn(actual,'volumeBasis'),false);
  close(actual.volume,6000);close(actual.mass,16.2);actual.centroid.forEach((v,k)=>close(v,[5,10,15][k]));
  [1755,1350,675].forEach((v,k)=>close(actual.inertia[k][k],v));assert.deepEqual(p.doc,before);
});
for (const [kind,expected] of [['import','quadrature'],['mesh','planar-exact']] as const) {
  test(`CAD actual native ${expected} reaches the public facade`, () => {
    const doc = cadDoc(kind), output = evaluateCadPart(doc).outputs[0], native = massPropertiesOf(output,density);
    assert.equal(native.method,expected,'the native producer establishes this fixture method first');
    const result = cadPart('native',doc).mass({density});assert.equal(result.method,native.method);assert.equal(Object.hasOwn(result,'volumeBasis'),false);
    close(result.volume,native.volume);close(result.mass,native.mass);assert.deepEqual(result.centroid,native.centroid);assert.deepEqual(result.inertia,native.inertia);
  });
  test(`Model native ${expected} survives eager producer and public facade`, () => {
    const doc = kind === 'import' ? sphereModel() : facetModel(), body = bodyOf(doc), native = nativeMassPropertiesOfBody(body);
    assert.ok(native);assert.equal(native.method,expected);assert.equal(body.massMethod,native.method);
    const result = modelPart('native',doc).mass({density});assert.equal(result.method,native.method);assert.equal(Object.hasOwn(result,'volumeBasis'),false);
    // Keep the facade's existing volume*density/1000 operation order; native mass can round differently.
    assert.deepEqual(numbers(result),{...numbers(body),mass:body.volume!*density/1000});
  });
}
for (const [name,doc] of [['box',()=>rectanglePart(13,23,7)],['quadrature sphere',sphereModel],['planar mesh',facetModel]] as const) {
  test(`${name} deferred mass fields report exactly the eager native method after settlement`, () => {
    const input = doc();forgetSnapshots();deferMasses(true);
    let pending: ProvenanceBody;
    try { pending = bodyOf(input); } finally { deferMasses(false); }
    assert.equal(pending.volume,null);assert.equal(pending.massMethod,undefined);assert.ok(pending.massRef!==undefined);
    assert.throws(()=>modelMass(pending,density),e=>e instanceof BarocssError && e.code==='MASS_UNKNOWN');
    const fields = massOfRef(pending.massRef)!;forgetSnapshots();const eager = bodyOf(input);
    assert.equal(fields.massMethod,eager.massMethod);assert.ok(eager.massMethod);assert.deepEqual(numbers(fields),numbers(eager));
  });
}

test('explicit native tessellation fixture retains its real estimate through the Model facade; no organic fallback claim', () => {
  const body = bodyOf(sphereModel()), native = nativeMassPropertiesOfBody(body);assert.ok(native);assert.equal(native.method,'quadrature');
  const brep = evaluateCadPart(cadDoc('import')).outputs[0].brep;
  const tessellated = brepMassProperties(brep,density,{quadratureSegments:0});assert.equal(tessellated.method,'tessellated');assert.ok(tessellated.volumeBound!==undefined);
  const fixture: ProvenanceBody = {...body,...numbers(tessellated),centroid:[...tessellated.centroid],inertia:tessellated.inertia.map(row=>[...row]),massMethod:tessellated.method,volumeBasis:volumeBasisOf(tessellated)};
  const result = modelMass(fixture,density);assert.equal(result.method,'tessellated');assert.deepEqual(result.volumeBasis,{method:'tessellated',bound:tessellated.volumeBound});
});
for (const bound of [1.25,null,0] as const) test(`tessellated estimate ${bound} stays in mm3, detached and unscaled by density`, () => {
  const body: ProvenanceBody = {...bodyOf(),massMethod:'tessellated',volumeBasis:{method:'tessellated',bound}};
  const before = structuredClone(body), first = modelMass(body,1), second = modelMass(body,7.85);
  assert.equal(first.method,'tessellated');assert.equal(second.method,'tessellated');assert.deepEqual(first.volumeBasis,{method:'tessellated',bound});assert.deepEqual(second.volumeBasis,first.volumeBasis);
  close(second.mass,first.mass*7.85);assert.equal(first.volume,second.volume);assert.deepEqual(first.centroid,second.centroid);
  assert.ok(first.volumeBasis);const observedBasis: NonNullable<MassResult['volumeBasis']> = first.volumeBasis;observedBasis.bound=999;assert.deepEqual(body,before);assert.deepEqual(modelMass(body,density).volumeBasis,{method:'tessellated',bound});
});
test('legacy or custom body without a producer method omits method rather than inferring it from family or basis', () => {
  const body = {...bodyOf()};delete body.massMethod;
  assert.equal(Object.hasOwn(modelMass(body,density),'method'),false);
  body.volumeBasis={method:'tessellated',bound:null};const result=modelMass(body,density);
  assert.equal(Object.hasOwn(result,'method'),false);assert.deepEqual(result.volumeBasis,{method:'tessellated',bound:null});
});
test('unavailable mass keeps MASS_UNKNOWN and never invents a method', () => {
  const body={...bodyOf(),volume:null,mass:null};delete body.massMethod;
  assert.throws(()=>modelMass(body,density),e=>e instanceof BarocssError&&e.code==='MASS_UNKNOWN');
});
test('mesh wire transfer/reuse and placement retain native method and basis metadata', () => {
  const body=bodyOf(sphereModel()),sender=new MeshSender(),receiver=new MeshReceiver();assert.equal(body.massMethod,'quadrature');
  for(const revision of [1,2]){
    const packed=sender.pack('method',{ok:true,revision,wallTime:0,bodies:[body]}),received=receiver.unpack('method',structuredClone(packed.result,{transfer:packed.transfer}));
    assert.ok(received.ok);assert.equal(received.bodies[0].massMethod,body.massMethod);
  }
  const placed=placeBody(structuredClone(body),identity,translation);assert.equal(placed.massMethod,body.massMethod);assert.deepEqual(placed.volumeBasis,body.volumeBasis);
  const fields={volume:1,mass:1,centroid:[0,0,0] as [number,number,number],inertia:[[1,0,0],[0,1,0],[0,0,1]],massMethod:'tessellated' as const,volumeBasis:{method:'tessellated' as const,bound:1.25}};
  const moved=placedMassFields(fields,[{m:identity,t:translation}]);assert.equal(moved.massMethod,'tessellated');assert.deepEqual(moved.volumeBasis,fields.volumeBasis);
});
for(const method of ['closed-form','planar-exact','quadrature','tessellated'] as const) test(`authenticated explicit ${method} enum fixture is accepted without semantic inference`,()=>{
  const body={...bodyOf(),massMethod:method},envelope=nativeMassEnvelope(source,body);
  assert.ok(receiveNativeMass(structuredClone(body),structuredClone(envelope),source));
});
for(const method of ['unknown','',null,3,{}]) test(`invalid mass method ${JSON.stringify(method)} cannot authenticate even with a matching generated envelope`,()=>{
  const body={...bodyOf(),massMethod:method} as unknown as BodyResult;
  assert.equal(receiveNativeMass(structuredClone(body),nativeMassEnvelope(source,body),source),false);
});
test('changing a valid method after signing invalidates eager body authentication',()=>{
  const body={...bodyOf(),massMethod:'closed-form' as Method},envelope=nativeMassEnvelope(source,body);
  assert.equal(receiveNativeMass({...structuredClone(body),massMethod:'quadrature'} as ProvenanceBody,envelope,source),false);
});
test('deferred method metadata is authenticated and tampering cannot patch a pending body',()=>{
  forgetSnapshots();deferMasses(true);let pending: ProvenanceBody;
  try{pending=bodyOf(rectanglePart(17,19,11));}finally{deferMasses(false);}
  assert.ok(pending.massRef!==undefined);const ref=pending.massRef,body=structuredClone(pending);
  assert.ok(receiveNativeMass(body,structuredClone(nativeMassEnvelope(source,pending)),source));
  const fields=massOfRef(ref)!;assert.ok(fields.massMethod);const envelope=structuredClone(nativeMassEnvelope(source,fields,ref)),patch=structuredClone(fields);
  assert.ok(receiveNativeMassPatch(patch,ref,envelope,source));assert.ok(matchesNativeMassPatch(body,patch));
  assert.equal(receiveNativeMassPatch({...structuredClone(fields),massMethod:'quadrature'},ref,envelope,source),false);
  patch.massMethod='quadrature';assert.equal(matchesNativeMassPatch(body,patch),false);
});
