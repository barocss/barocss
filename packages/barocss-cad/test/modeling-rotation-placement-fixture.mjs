import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chamferPart } from './modeling-chamfer-chain-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { proveRotation, mappedPoint, MAPS } from './modeling-rotation-fixture.mjs';
import { constrainedGusset, authoredDocument as gussetDocument, proveSketch } from './modeling-gusset-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged,
  provePreview, emptyLedgers, accounting } from './modeling-scale-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged, provePreview, emptyLedgers, accounting };

// Frozen #1994 campaign. These fixture oracles never call geometry providers.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24, offsetX: 40 });
export const EDITED = Object.freeze({ ...DEFAULTS, offsetX: 56 });
export const EXPECTED_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 350, returnedLedgerBindingObservations: 4320,
  returnedLedgerD1: 12960, knownSourceCompilations: 426, combinedBindingObservations: 5256, knownD1: 15768,
  initialFaceConstructionCount: 72, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 7, sourceModelCalls: 6, coldModelCalls: 1, tessellations: 2,
  prisms: 4, firstChamfers: 2, secondChamfers: 2, successfulRotations: 4, successfulTranslations: 6, refusedTranslations: 1,
  parentValidations: 11, initialTargetFaces: 72, targetQualifications: 10, representabilityRefusals: 1,
  massQueries: 0, exports: 0, cpuBufferPreparations: 0, standaloneValidators: 0, ...EXPECTED_TOTALS });
export function placedRail(cad) {
  const chain = chamferPart(cad), offsetX = chain.model.parameter('offsetX',40), middle = chain.part.rotate({axis:'x',angleDegrees:90});
  const placed = middle.translate([offsetX,16,0]);
  return {...chain,middle,placed,build:()=>chain.model.build({original:chain.part,middle,placed})};
}
export function placedRectangle(cad) {
  const model=cad.model(),original=model.sketch.rectangle({width:32,height:24}).extrude(8,{from:3});
  const middle=original.rotate({axis:'y',angleDegrees:-90}),placed=middle.translate([-0,0,-0]);
  return {model,original,middle,placed,build:()=>model.build({original,middle,placed})};
}
export function placedGusset(cad) {
  const chain=constrainedGusset(cad),middle=chain.gusset.rotate({axis:'z',angleDegrees:90}),placed=middle.translate([-48,-16,8]);
  return {...chain,middle,placed,build:()=>chain.model.build({original:chain.gusset,middle,placed})};
}
export function authoredDocument(parameters=DEFAULTS,variant='rail') {
  const p=parameter=>({parameter});
  const original=variant==='gusset'?gussetDocument():{format:'barocss-cad-model',schema:1,units:'mm',parameters:variant==='rail'?{...parameters}:{},
    nodes:[{kind:'sketch',profile:'rectangle',min:[0,0],max:[32,24]}, {kind:'extrude',sketch:0,height:8,...(variant==='rectangle'?{from:3}:{})},
      ...(variant==='rail'?[{kind:'chamfer',parent:{node:1,side:'solid'},edge:{parallelTo:'x',at:{y:0,z:'max'}},distance:p('frontDistance')},
        {kind:'chamfer',parent:{node:2,side:'solid'},edge:{parallelTo:'x',at:{y:p('backY'),z:'max'}},distance:p('backDistance')}]:[])]};
  const parent=original.nodes.length-1,axis=variant==='rail'?'x':variant==='rectangle'?'y':'z',angleDegrees=variant==='rectangle'?-90:90;
  const offset=variant==='rail'?[p('offsetX'),16,0]:variant==='rectangle'?[-0,0,-0]:[-48,-16,8];
  return {...original,nodes:[...original.nodes,{kind:'rotate',parent:{node:parent,side:'solid'},axis,angleDegrees},
    {kind:'translate',parent:{node:parent+1,side:'solid'},offset}],
    outputs:{original:{node:parent,side:'solid'},middle:{node:parent+1,side:'solid'},placed:{node:parent+2,side:'solid'}}};
}
export function work(snapshot,reused,evaluated,previous) {
  exactData(snapshot.recomputation,{reusedFeatures:reused,evaluatedFeatures:evaluated});
  exactData([...reused,...evaluated].sort(),snapshot.features.map((_,i)=>i));
  const kinds=snapshot.features.length===6?['sketch','extrude','chamfer','chamfer','rotate','translate']:['sketch','extrude','rotate','translate'];
  exactData(snapshot.features,kinds.map((kind,index)=>({kind,index,dependencies:index?[index-1]:[]})));
  if(previous){
    for(const field of ['parameters','evidence','bodies'])assert.notEqual(snapshot[field],previous[field]);
    for(const i of reused)assert.equal(snapshot.evidence[i],previous.evidence[i]);
    for(const i of evaluated)assert.notEqual(snapshot.evidence[i],previous.evidence[i]);
    for(const label of ['original','middle'])assert.equal(snapshot.bodies[label],previous.bodies[label]);
    assert.notEqual(snapshot.bodies.placed,previous.bodies.placed);
  }
  deepFrozen(snapshot);
}
// Adapt only this copy of the adopted finishing translation oracle to F/U.
// The historical six/eight-Face oracles and every provider remain unchanged.
const fraction = v => ({ n: BigInt(v.numerator), d: BigInt(v.denominator) });
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const equal = (a, b) => assert.equal(a.n * b.d, b.n * a.d);
const dot = (a, b) => a.reduce((sum, value, i) => add(sum, mul(value, b[i])), { n: 0n, d: 1n });
const sorted = values => values.map(signedData).sort();
const faceRef = a => ({ sourceId: a.sourceId, faceId: a.face.options.faceId, surfaceId: a.face.plane.id,
  loopId: a.face.loop.id, evaluationId: a.face.options.evaluationId });
const local = (face, field, id) => ({ sourceId: face.sourceId, faceId: face.faceId, [field]: id });
const faceAt = (solid, ref) => { const a = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(a); assert.equal(a.face.options.faceId, ref.faceId); return a.face; };
function point(actual, original, offset, coefficients = false) {
  exactData([actual.length, original.length], [3, 3]);
  for (let i = 0; i < 3; i++) {
    const expected = add(binary64(original[i]), binary64(offset[i])); equal(binary64(actual[i]), expected);
    assert.ok(Math.abs(actual[i]) <= 10000);
    // Only stored coefficients promise zero sign bits. Derived native vertices
    // retain exact rational coordinates and the unchanged whole qualification.
    if (coefficients && offset[i] === 0) assert.ok(Object.is(actual[i], original[i]));
    else if (coefficients && expected.n === 0n) assert.ok(Object.is(actual[i], 0));
  }
}
function completeSource(face) {
  assert.equal(face.sourceVersion, 0); exactData(face.model.objects, [face.plane, ...face.loop.edges]);
  assert.ok(face.source.includes('@model ' + face.options.evaluationId));
  for (const object of face.model.objects) {
    const marker = '@' + object.kind + ' #' + object.id + ' ', start = face.source.indexOf(marker); assert.ok(start >= 0);
    const text = face.source.slice(start, face.source.indexOf('}', start));
    const properties = object.kind === 'surface' ? ['degreeU', 'degreeV', 'knotsU', 'knotsV'] : ['degree', 'knots'];
    for (const property of [...properties, 'controlPoints', 'weights']) {
      const name = property.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      const match = text.match(new RegExp('(?:^|[;{])\\s*' + name + '\\s*:\\s*([^;]+);')); assert.ok(match);
      exactData(JSON.parse(match[1]), object[property]);
    }
  }
}
function bijection(entries, a, b) {
  assert.equal(entries.length, a.length); assert.equal(a.length, b.length);
  exactData(sorted(entries.map(e => e.original)), sorted(a)); exactData(sorted(entries.map(e => e.translated)), sorted(b));
  assert.equal(new Set(entries.map(e => signedData(e.original))).size, entries.length);
  assert.equal(new Set(entries.map(e => signedData(e.translated))).size, entries.length);
  return new Map(entries.map(e => [signedData(e.original), e.translated]));
}
export function proveTranslation(native, original, offset) {
  const F = original.request.assets.length, U = original.request.assets.reduce((sum, asset) => sum + asset.face.topology.loop.uses.length, 0);
  assert.ok(F === 6 || F === 8);
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.offsetMM, offset);
  const parent = native.request.parent, target = native.solid, lineage = native.lineage, maps = {};
  assert.notEqual(target, original); assert.notEqual(target.request.options.solidId, original.request.options.solidId);
  exactData(target.certificate.volumeMM3, parent.certificate.volumeMM3);
  maps.faces = bijection(lineage.faces, parent.request.assets.map(faceRef), target.request.assets.map(faceRef));
  const inventories = [['curves', f => f.loop.edges, 'curveId'], ['uses', f => f.topology.loop.uses, 'useId'],
    ['pcurves', f => f.pcurves, 'pcurveId'], ['localEdges', f => f.topology.edges, 'edgeId'], ['localVertices', f => f.topology.vertices, 'vertexId']];
  for (const [name, field, id] of inventories) maps[name] = bijection(lineage[name], ...[parent, target].map(solid =>
    solid.request.assets.flatMap(a => field(a.face).map(item => local(faceRef(a), id, item.id)))));
  for (const [name, field] of [['edges', 'edgeId'], ['vertices', 'vertexId']]) maps[name] = bijection(lineage[name],
    ...[parent, target].map(solid => solid.graph[name].map(item => ({ [field]: item.id }))));
  exactData(['faces', 'curves', 'uses', 'pcurves', 'localEdges', 'localVertices', 'edges', 'vertices'].map(k => lineage[k].length), [F, U, U, U, U, U, original.graph.edges.length, original.graph.vertices.length]);
  const mapped = (kind, ref) => { const value = maps[kind].get(signedData(ref)); assert.ok(value); return value; };
  const id = (kind, ref, field, value) => mapped(kind, local(ref, field, value))[field];
  const globalId = (kind, field, value) => mapped(kind, { [field]: value })[field];
  const mappedUse = use => {
    const asset = parent.request.assets.find(a => a.sourceId === use.sourceId); assert.ok(asset);
    const next = mapped('uses', local(faceRef(asset), 'useId', use.useId)); return { sourceId: next.sourceId, useId: next.useId };
  };
  const namespaceIds = solid => [solid.request.options.solidId, solid.request.options.resultIdPrefix,
    ...solid.request.assets.flatMap(({ sourceId, face }) => [sourceId, face.plane.id, face.loop.id, face.options.faceId,
      face.options.evaluationId, face.options.resultIdPrefix, ...face.loop.edges.map(c => c.id), ...face.pcurves.map(p => p.id),
      ...face.topology.loop.uses.map(u => u.id), ...face.topology.edges.map(e => e.id), ...face.topology.vertices.map(v => v.id)])];
  const namespaces = new Set(namespaceIds(parent));
  assert.ok(namespaceIds(target).every(id => !namespaces.has(id)), 'complete target namespace is independent');
  for (const link of lineage.faces) {
    const before = faceAt(parent, link.original), after = faceAt(target, link.translated);
    for (const key of Object.keys(link.original)) assert.notEqual(link.original[key], link.translated[key]);
    completeSource(before); completeSource(after); exactData(after.options.orientation, before.options.orientation);
    for (const field of ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'weights']) exactData(after.plane[field], before.plane[field]);
    exactData(after.plane.controlPoints.map(r => r.length), before.plane.controlPoints.map(r => r.length));
    before.plane.controlPoints.forEach((row, i) => row.forEach((p, j) => point(after.plane.controlPoints[i][j], p, offset, true)));
    exactData(after.loop.edges.map(c => c.id), before.loop.edges.map(c => id('curves', link.original, 'curveId', c.id)));
    exactData(after.topology.loop.uses.map(u => u.id), before.topology.loop.uses.map(u => id('uses', link.original, 'useId', u.id)));
    const a = parent.supports.find(s => s.sourceId === link.original.sourceId), b = target.supports.find(s => s.sourceId === link.translated.sourceId); assert.ok(a && b);
    for (let i = 0; i < 3; i++) { equal(fraction(b.outwardNormal[i]), fraction(a.outwardNormal[i])); equal(fraction(b.originMM[i]), add(fraction(a.originMM[i]), binary64(offset[i]))); }
    equal(fraction(b.offset), add(fraction(a.offset), dot(a.outwardNormal.map(fraction), offset.map(binary64))));
  }
  for (const [kind, field, key] of inventories) for (const link of lineage[kind]) {
    const before = field(faceAt(parent, link.original)).find(item => item.id === link.original[key]);
    const after = field(faceAt(target, link.translated)).find(item => item.id === link.translated[key]); assert.ok(before && after); assert.notEqual(before.id, after.id);
    if (kind === 'curves') {
      for (const field of ['kind', 'degree', 'knots', 'weights']) exactData(after[field], before[field]);
      assert.equal(after.controlPoints.length, before.controlPoints.length); before.controlPoints.forEach((p, i) => point(after.controlPoints[i], p, offset, true));
    }
    if (kind === 'localVertices') point(after.point, before.point, offset);
    if (kind === 'uses') { exactData(after.interval, before.interval); assert.equal(after.sense, before.sense); }
    if (kind === 'pcurves') { exactData(after.domain, before.domain); for (const field of ['degree', 'knots', 'weights']) exactData(after.curve[field], before.curve[field]); }
    for (const [name, refField] of [['curves', 'curveId'], ['localEdges', 'edgeId'], ['pcurves', 'pcurveId']]) {
      if (Object.hasOwn(before, refField)) assert.equal(after[refField], id(name, link.original, refField, before[refField]));
    }
    if (before.vertexIds) exactData(after.vertexIds, before.vertexIds.map(value => id('localVertices', link.original, 'vertexId', value)));
  }
  exactData(target.request.edgePairs, parent.request.edgePairs.map(pair => ({ a: mappedUse(pair.a), b: mappedUse(pair.b) })));
  for (const link of lineage.edges) {
    const a = parent.graph.edges.find(e => e.id === link.original.edgeId), b = target.graph.edges.find(e => e.id === link.translated.edgeId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); exactData(b.parameterMapAtoB, a.parameterMapAtoB); assert.equal(b.pairIndex, a.pairIndex);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v)));
    exactData(b.uses.map(u => ({ sourceId: u.sourceId, useId: u.use.id })), a.uses.map(u => mappedUse({ sourceId: u.sourceId, useId: u.use.id })));
  }
  for (const link of lineage.vertices) {
    const a = parent.graph.vertices.find(v => v.id === link.original.vertexId), b = target.graph.vertices.find(v => v.id === link.translated.vertexId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); point(b.pointMM, a.pointMM, offset); exactData(sorted(b.members), sorted(a.members.map(m => mapped('localVertices', m))));
  }
  const mappedFace = f => { const a = parent.request.assets.find(a => a.sourceId === f.sourceId && a.face.options.faceId === f.faceId); assert.ok(a); return mapped('faces', faceRef(a)); };
  for (const a of parent.graph.faces) {
    const ref = mappedFace(a), b = target.graph.faces.find(f => f.sourceId === ref.sourceId && f.faceId === ref.faceId); assert.ok(b);
    assert.equal(b.surfaceId, ref.surfaceId); assert.equal(b.loopId, ref.loopId);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v))); exactData(b.edgeIds, a.edgeIds.map(e => globalId('edges', 'edgeId', e)));
  }
  assert.equal(target.graph.vertexLinks.length, parent.graph.vertexLinks.length);
  for (const a of parent.graph.vertexLinks) {
    const b = target.graph.vertexLinks.find(v => v.vertexId === globalId('vertices', 'vertexId', a.vertexId)); assert.ok(b);
    exactData(b.cycleEdgeIds, a.cycleEdgeIds.map(e => globalId('edges', 'edgeId', e)));
    exactData(b.arcs, a.arcs.map(arc => { const f = mappedFace(arc); return { sourceId: f.sourceId, faceId: f.faceId,
      fromEdgeId: globalId('edges', 'edgeId', arc.fromEdgeId), toEdgeId: globalId('edges', 'edgeId', arc.toEdgeId) }; }));
  }
  for (let i = 0; i < 3; i++) equal(fraction(target.certificate.strictInteriorMM[i]), add(fraction(parent.certificate.strictInteriorMM[i]), binary64(offset[i])));
  const r = native.report; exactData(r.parentValidation, parent.report); exactData(r.targetQualification, target.report);
  exactData(r.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: F, targetQualificationCount: 1, retries: 0 });
  for (const report of [r.parentValidation.childNativeWork, r.targetQualification.childNativeWork, r.initialFaceConstruction]) count(report, [F, 3 * U, 9 * U]);
  exactData([r.initialFaceConstruction.faceCount, r.initialFaceConstruction.curveD1Count, r.initialFaceConstruction.pcurveD1Count, r.initialFaceConstruction.surfaceD1Count], [F, 3 * U, 3 * U, 3 * U]);
  assert.ok(r.exactWork.operations > 0 && r.exactWork.operations <= 200000); assert.ok(r.exactWork.maximumObservedBits <= 8192); deepFrozen(native);
  return { fullSourceAdoption: true, bijectiveLocalAndGlobalLineage: true, exactCoordinatesNormalsSupportsAndVolume: true,
    preservedDomainWeightAndZeroBits: true, regeneratedNativePcurves: true, lineageSHA256: dataHash(lineage), nativeSHA256: dataHash(native) };
}

function count(report, expected) {
  exactData([report.sourceCompilationCount,report.bindingObservationCount,report.totalD1Count],expected);
  if(Object.hasOwn(report,'retries'))assert.equal(report.retries,0);
}
const namespaceIds=solid=>[solid.request.options.solidId,solid.request.options.resultIdPrefix,
  ...solid.graph.edges.map(edge=>edge.id),...solid.graph.vertices.map(vertex=>vertex.id),
  ...solid.request.assets.flatMap(({sourceId,face})=>[sourceId,face.plane.id,face.loop.id,face.options.faceId,face.options.evaluationId,
    face.options.resultIdPrefix,...face.loop.edges.map(curve=>curve.id),...face.pcurves.map(curve=>curve.id),
    ...face.topology.loop.uses.map(use=>use.id),...face.topology.edges.map(edge=>edge.id),...face.topology.vertices.map(vertex=>vertex.id)])];
const rotatedFraction=(values,spec)=>MAPS[spec.axis][spec.degrees].map(component=>{
  const value=fraction(values[Math.abs(component)-1]);return component>0?value:{n:-value.n,d:value.d};
});
/** Join the two actual eight-class bijections by exact middle identities. */
export function composeLineage(rotation,translation) {
  const result={};
  for(const kind of ['faces','curves','pcurves','uses','localEdges','localVertices','edges','vertices']){
    const first=rotation.lineage[kind],second=translation.lineage[kind],next=new Map(second.map(link=>[signedData(link.original),link.translated]));
    assert.equal(next.size,second.length);assert.equal(first.length,second.length);
    result[kind]=first.map(link=>{const placed=next.get(signedData(link.rotated));assert.ok(placed);return {original:link.original,middle:link.rotated,placed};});
    for(const side of ['original','middle','placed'])assert.equal(new Set(result[kind].map(link=>signedData(link[side]))).size,result[kind].length);
    exactData(sorted(result[kind].map(link=>link.middle)),sorted(second.map(link=>link.original)));
    exactData(sorted(result[kind].map(link=>link.placed)),sorted(second.map(link=>link.translated)));
  }
  return result;
}
export function provePlacement(rotation,translation,original,spec,offset) {
  const middle=rotation.solid,placed=translation.solid;
  const rotationProof=proveRotation(rotation,original,spec),translationProof=proveTranslation(translation,middle,offset);
  const composed=composeLineage(rotation,translation),seen=new Set();
  for(const [index,solid]of [original,middle,placed].entries()){
    // A qualified original may reuse local IDs across source/role scopes.
    // Rebuilt targets allocate fresh complete raw namespaces; the typed
    // eight-class bijections above establish original reference coverage.
    const ids=namespaceIds(solid);if(index)assert.equal(new Set(ids).size,ids.length);
    assert.ok(ids.every(id=>!seen.has(id)),'whole original/middle/placed namespace inventories are disjoint');ids.forEach(id=>seen.add(id));
  }
  for(const link of composed.faces){
    const before=faceAt(original,link.original),after=faceAt(placed,link.placed);
    before.plane.controlPoints.forEach((row,i)=>row.forEach((p,j)=>point(after.plane.controlPoints[i][j],mappedPoint(p,spec),offset,true)));
    for(const curve of before.loop.edges){
      const mapping=composed.curves.find(item=>item.original.sourceId===link.original.sourceId&&item.original.curveId===curve.id);assert.ok(mapping);
      const next=after.loop.edges.find(item=>item.id===mapping.placed.curveId);assert.ok(next);
      curve.controlPoints.forEach((p,i)=>point(next.controlPoints[i],mappedPoint(p,spec),offset,true));
    }
    const a=original.supports.find(item=>item.sourceId===link.original.sourceId),b=placed.supports.find(item=>item.sourceId===link.placed.sourceId);assert.ok(a&&b);
    const normal=rotatedFraction(a.outwardNormal,spec),origin=rotatedFraction(a.originMM,spec);
    for(let i=0;i<3;i++){equal(fraction(b.outwardNormal[i]),normal[i]);equal(fraction(b.originMM[i]),add(origin[i],binary64(offset[i])));}
    equal(fraction(b.offset),add(fraction(a.offset),dot(normal,offset.map(binary64))));
  }
  for(const link of composed.localVertices){
    const a=faceAt(original,link.original).topology.vertices.find(v=>v.id===link.original.vertexId);
    const b=faceAt(placed,link.placed).topology.vertices.find(v=>v.id===link.placed.vertexId);assert.ok(a&&b);point(b.point,mappedPoint(a.point,spec),offset);
  }
  for(const link of composed.vertices){
    const a=original.graph.vertices.find(v=>v.id===link.original.vertexId),b=placed.graph.vertices.find(v=>v.id===link.placed.vertexId);assert.ok(a&&b);
    point(b.pointMM,mappedPoint(a.pointMM,spec),offset);
  }
  const interior=rotatedFraction(original.certificate.strictInteriorMM,spec);
  for(let i=0;i<3;i++)equal(fraction(placed.certificate.strictInteriorMM[i]),add(interior[i],binary64(offset[i])));
  exactData(placed.certificate.volumeMM3,original.certificate.volumeMM3);
  return {rotation:rotationProof,translation:translationProof,composedLineage:composed,composedEightClassBijections:true,
    exactRotatedThenTranslatedCoefficients:true,exactComposedSupportsVerticesInteriorVolume:true,
    sampledBindingScope:'whole Native self-consistency; no sampled cross-copy D1 bit covariance',composedLineageSHA256:dataHash(composed)};
}
export function proveSnapshot(snapshot,parameters=DEFAULTS,variant='rail') {
  const document=authoredDocument(parameters,variant);assert.equal(snapshot.save(),signedData(document)+'\n');exactData(snapshot.parameters,document.parameters);
  exactData(snapshot.suppression,{});exactData(Object.keys(snapshot.bodies).sort(),['middle','original','placed']);
  exactData(snapshot.evidence.map(e=>e.kind),document.nodes.map(node=>node.kind));
  const original=snapshot.bodies.original.native,middle=snapshot.bodies.middle.native,placed=snapshot.bodies.placed.native;
  const rotation=snapshot.evidence.at(-2).native,translation=snapshot.evidence.at(-1).native;
  assert.equal(middle,rotation.solid);assert.equal(placed,translation.solid);exactData(rotation.request.parent,original);exactData(translation.request.parent,middle);
  const volume=variant==='rail'?6144-16*parameters.frontDistance**2-16*parameters.backDistance**2:variant==='rectangle'?6144:6912;
  for(const body of Object.values(snapshot.bodies)){assert.equal(body.family,'convex-planar');proveConvex(body.native,volume,variant==='rail'?[8,18,12]:[6,12,8]);}
  const prism=snapshot.evidence[1].native;exactData(prism.report.childNativeWork,PRISM_COUNTS);exactData(prism.request.sketch,snapshot.evidence[0].native);
  const caps=[];
  if(variant==='rail'){
    const [first,second]=snapshot.evidence.slice(2,4).map(e=>e.native);
    exactData(first.split.request.parent,prism.solid);exactData(second.split.request.parent,first.split.negative.solid);assert.equal(original,second.split.negative.solid);
    for(const [i,feature]of [first,second].entries()){
      const removed=16*[parameters.frontDistance,parameters.backDistance][i]**2;
      exactData(feature.metric.removedVolumeMM3,{numerator:String(removed),denominator:'1'});assert.equal(feature.split.report.volumeMM3.conserved,true);
      proveConvex(feature.split.positive.solid,removed,[5,9,6]);proveConvex(feature.split.negative.solid,i?volume:6144-removed,[7+i,15+3*i,10+2*i]);
    }
    const front=first.split.lineage.faces.find(face=>face.side==='negative'&&face.role==='cap').output;
    const retained=second.split.lineage.faces.filter(face=>face.side==='negative'&&face.parent?.sourceId===front.sourceId&&face.parent.faceId===front.faceId);
    assert.equal(retained.length,1);assert.equal(retained[0].role,'retained');
    const back=second.split.lineage.faces.find(face=>face.side==='negative'&&face.role==='cap');assert.equal(back.key,second.lineage.chamferFaceKey);
    for(const cap of [retained[0].output,back.output]){faceAt(original,cap);caps.push(cap);}
  }else{assert.equal(original,prism.solid);if(variant==='gusset')proveSketch(snapshot.evidence[0].native);}
  const node=document.nodes.at(-2),spec={axis:node.axis,degrees:node.angleDegrees===-90?270:node.angleDegrees};
  const offset=variant==='rail'?[parameters.offsetX,16,0]:variant==='rectangle'?[-0,0,-0]:[-48,-16,8];
  const placement=provePlacement(rotation,translation,original,spec,offset);
  const retainedCaps=caps.map(cap=>{const mapping=placement.composedLineage.faces.find(link=>link.original.sourceId===cap.sourceId&&link.original.faceId===cap.faceId);assert.ok(mapping);faceAt(middle,mapping.middle);faceAt(placed,mapping.placed);return mapping;});
  const bounds=points=>({min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))});
  const boundsMM=Object.fromEntries(Object.entries(snapshot.bodies).map(([label,body])=>[label,bounds(body.native.graph.vertices.map(vertex=>vertex.pointMM))]));
  const expectedMiddle=original.graph.vertices.map(v=>mappedPoint(v.pointMM,spec)),expectedPlaced=expectedMiddle.map(p=>p.map((value,i)=>offset[i]===0?value:value+offset[i]));
  for(const [label,points]of [['middle',expectedMiddle],['placed',expectedPlaced]])for(const side of ['min','max'])for(let i=0;i<3;i++)equal(binary64(boundsMM[label][side][i]),binary64(bounds(points)[side][i]));
  if(variant==='rail'){
    for(const [label,expected]of Object.entries({middle:{min:[0,-8,0],max:[32,0,24]},placed:{min:[parameters.offsetX,8,0],max:[parameters.offsetX+32,16,24]}}))
      for(const side of ['min','max'])for(let i=0;i<3;i++)equal(binary64(boundsMM[label][side][i]),binary64(expected[side][i]));
  }
  if(variant==='rectangle'){assert.equal(document.nodes[1].from,3);assert.ok(Object.is(translation.request.offsetMM[0],-0));assert.ok(Object.is(translation.request.offsetMM[2],-0));}
  deepFrozen(snapshot);
  return {volumesMM3:{original:volume,middle:volume,placed:volume},boundsMM,retainedBevelCaps:retainedCaps,placement,
    authoredSHA256:sha256(snapshot.save()),bodiesSHA256:dataHash(snapshot.bodies),evidenceSHA256:dataHash(snapshot.evidence),snapshotSHA256:dataHash(snapshotData(snapshot))};
}
export function proveRefusal(error,CadModelError,accepted) {
  assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'translate');
  const cause=error.cause;assert.ok(cause instanceof Error);assert.equal(cause.name,'ModelingTranslationError');assert.equal(cause.code,'REPRESENTABILITY');assert.equal(cause.stage,'stage-coefficients');
  assert.ok(cause.cause instanceof Error);assert.equal(cause.cause.name,'ConvexPlanarSolidError');assert.equal(cause.cause.code,'REPRESENTABILITY');assert.match(cause.cause.message,/not exactly represented in binary64/);
  let failed;
  for(const {sourceId,face}of accepted.bodies.middle.native.request.assets){
    const entries=face.plane.controlPoints.flatMap((row,i)=>row.map((p,j)=>[face.plane.id+'/'+i+'/'+j,p])).concat(face.loop.edges.flatMap(c=>c.controlPoints.map((p,i)=>[c.id+'/'+i,p])));
    for(const [path,p]of entries){const exact=add(binary64(p[0]),binary64(.1)),rounded=binary64(p[0]+.1);if(exact.n*rounded.d!==rounded.n*exact.d){failed=sourceId+'/'+path+'/0';break;}}if(failed)break;
  }
  assert.ok(failed);assert.equal(cause.entity,failed);exactData(cause.report.parentValidation,accepted.bodies.middle.native.report);
  exactData(cause.report.directCalls,{parentValidationCount:1,initialFaceConstructionCount:0,targetQualificationCount:0,retries:0});count(cause.report.parentValidation.childNativeWork,[8,108,324]);deepFrozen(cause.report);
  for(const value of [error,cause])for(const key of ['solid','bodies','evidence','lineage'])assert.equal(Object.hasOwn(value,key),false);
  return {code:cause.code,stage:cause.stage,entity:cause.entity,actualParentValidation:cause.report.parentValidation,originalCauseRetained:true,
    independentExactRepresentabilityRefusal:true,noTargetFaceConstruction:true,noTargetQualification:true};
}
export function collectLedgers(ledgers,snapshot,label) {
  for(const index of snapshot.recomputation.evaluatedFeatures){
    const evidence=snapshot.evidence[index],entry=report=>({label,index,report});
    if(evidence.kind==='sketch')ledgers.sketches.push(entry(evidence.native.report));
    if(evidence.kind==='extrude')ledgers.prisms.push(entry(evidence.native.report.childNativeWork));
    if(evidence.kind==='chamfer')ledgers[index===2?'firstChamfers':'secondChamfers'].push(entry(evidence.native.report.nativeWork));
    if(evidence.kind==='rotate'||evidence.kind==='translate'){
      ledgers.parents.push(entry(evidence.native.report.parentValidation.childNativeWork));ledgers.targets.push(entry(evidence.native.report.targetQualification.childNativeWork));ledgers.initialFaces.push(entry(evidence.native.report.initialFaceConstruction));
    }
  }
}
// Shared finite recorder for the two actual processes. Merely importing it does
// no CAD work or file writes. Raw results are persisted before any test oracle.
export function recorder(mode, entry, directory, source) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
  assert.equal(process.argv.length, 2); assert.ok(mode === 'source' || mode === 'cold');
  mkdirSync(directory, { recursive: true });
  const started = performance.now(), receipt = resolve(directory, mode + '-flow.json');
  const flow = { status: 'running', issue: 1994, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
    startedAt: new Date().toISOString(), groupStartedAtMS: source?.groupStartedAtMS ?? Date.now(), entrySHA256: sha256(readFileSync(entry)),
    modelCalls: 0, tessellations: 0, massQueries: 0, exports: 0, standaloneValidators: 0, cpuBufferPreparations: 0,
    stages: [], artifacts: {}, returnedLedgers: emptyLedgers(), nativeElapsedMS: 0, expectedWholeCampaign: EXPECTED_CAMPAIGN,
    timingScope: 'stage action plus artifact persistence; not isolated kernel timing', fullTransitiveNativeCoverage: 'NOT_MEASURED',
    sourceDerivedExpectedWorkIsNotInstrumented: true, limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 },
    externalSerialProcessGroupTimeoutRequired: true };
  writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
  const write = () => writeFileSync(receipt, signedData(flow) + '\n');
  const artifact = (filename, value, scope, raw = false) => {
    const bytes = raw ? value : signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
    writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
    flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write(); return bytes;
  };
  const budget = () => {
    const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
    assert.ok(Date.now() - flow.groupStartedAtMS < 600000 && flow.nativeElapsedMS + (source?.nativeElapsedMS ?? 0) < 600000);
  };
  const stage = (kind, label, action, filename) => {
    budget(); assert.ok(flow[kind] < (kind === 'modelCalls' ? mode === 'source' ? 6 : 1 : mode === 'source' ? 2 : 0));
    flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
    try {
      let result;
      try { result = action(); outcome = 'returned'; }
      catch (error) { failure = errorData(error); artifact(filename + '.refusal.json', failure, 'original thrown error and complete cause before any refusal oracle'); throw error; }
      artifact(filename, kind === 'modelCalls' ? snapshotData(result) : result, 'actual complete result before fixture oracles');
      if (kind === 'modelCalls') collectLedgers(flow.returnedLedgers, result, label);
      else flow.returnedLedgers.previews.push({ label, report: result.report.parentNativeWork });
      return result;
    } finally {
      const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
      flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
    }
  };
  const fail = error => { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); };
  const finish = () => { budget(); flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write(); };
  return { flow, write, artifact, stage, fail, finish };
}
