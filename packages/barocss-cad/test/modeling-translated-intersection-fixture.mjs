import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { signedData,sha256,dataHash,exactData,deepFrozen,snapshotData,errorData,hold,unchanged } from './modeling-scale-fixture.mjs';
export { signedData,sha256,dataHash,exactData,deepFrozen,snapshotData,errorData,hold,unchanged };

// Frozen #2002: six evaluations and one preview. No fixture calls a provider.
export const DEFAULTS=Object.freeze({offsetX:8});
export const EDITED=Object.freeze({offsetX:16});
export const EXPECTED_TOTALS=Object.freeze({returnedLedgerSourceCompilations:225,returnedLedgerBindingObservations:2790,returnedLedgerD1:8370,
  knownAvailableSourceCompilations:257,knownAvailableBindingObservations:3150,knownAvailableD1:9450,availableTranslationInitialFaces:28,standaloneSketches:4,
  wholeDerivedSourceCompilations:325,wholeDerivedBindingObservations:4014,wholeDerivedD1:12042,
  refusedDerivedSourceCompilations:68,refusedDerivedBindingObservations:864,refusedDerivedD1:2592,
  refusedWorkScope:'source-derived call paths only; failed public frames expose no complete Native reports',fullTransitiveNativeCoverage:'NOT_MEASURED'});
export const EXPECTED_CAMPAIGN=Object.freeze({modelCalls:6,sourceModelCalls:5,coldModelCalls:1,tessellations:1,
  successfulIntersections:4,faceContactRefusals:1,disjointRefusals:1,sourceDerivedTranslations:6,sourceDerivedIntersectionRoots:6,
  sourceDerivedTranslationParentValidations:6,sourceDerivedTranslationTargetQualifications:6,sourceDerivedTranslationInitialFaces:42,
  returnedIntersectionNewFaces:27,sourceDerivedIntersectionParentReconstructions:12,returnedIntersectionOutputQualifications:4,
  massQueries:0,exports:0,cpuBufferPreparations:0,standaloneValidators:0,...EXPECTED_TOTALS});
export function translatedOverlap(cad){
  const model=cad.model(),offsetX=model.parameter('offsetX',8);
  const original=model.sketch.polygon([[0,0],[32,0],[32,16],[16,32],[0,32]]).extrude(8);
  const tool=model.sketch.rectangle({min:[8,-8],max:[40,24]}).extrude(4);
  const translated=original.translate([offsetX,0,0]),overlap=translated.intersect(tool);
  return {model,original,tool,translated,overlap,build:()=>model.build({original,tool,translated,overlap})};
}
export function authoredDocument(parameters=DEFAULTS){
  return {format:'barocss-cad-model',schema:1,units:'mm',parameters:{...parameters},nodes:[
    {kind:'sketch',profile:'polygon',points:[[0,0],[32,0],[32,16],[16,32],[0,32]]},{kind:'extrude',sketch:0,height:8},
    {kind:'sketch',profile:'rectangle',min:[8,-8],max:[40,24]},{kind:'extrude',sketch:2,height:4},
    {kind:'translate',parent:{node:1,side:'solid'},offset:[{parameter:'offsetX'},0,0]},
    {kind:'intersect',left:{node:4,side:'solid'},right:{node:3,side:'solid'}}],
    outputs:{original:{node:1,side:'solid'},tool:{node:3,side:'solid'},translated:{node:4,side:'solid'},overlap:{node:5,side:'solid'}}};
}
export function work(snapshot,reused,evaluated,previous){
  exactData(snapshot.recomputation,{reusedFeatures:reused,evaluatedFeatures:evaluated});exactData([...reused,...evaluated].sort(),[0,1,2,3,4,5]);
  exactData(snapshot.features,[{kind:'sketch',index:0,dependencies:[]},{kind:'extrude',index:1,dependencies:[0]},
    {kind:'sketch',index:2,dependencies:[]},{kind:'extrude',index:3,dependencies:[2]},
    {kind:'translate',index:4,dependencies:[1]},{kind:'intersect',index:5,dependencies:[4,3]}]);
  if(previous){
    for(const field of ['parameters','evidence','bodies'])assert.notEqual(snapshot[field],previous[field]);
    for(const i of reused)assert.equal(snapshot.evidence[i],previous.evidence[i]);for(const i of evaluated)assert.notEqual(snapshot.evidence[i],previous.evidence[i]);
    for(const label of ['original','tool'])assert.equal(snapshot.bodies[label],previous.bodies[label]);
    for(const label of ['translated','overlap'])assert.notEqual(snapshot.bodies[label],previous.bodies[label]);
  }
  deepFrozen(snapshot);
}
// Copy only the adopted generic translation oracle into this new fixture;
// specialize it to the actual seven-Face seed. Stored coefficients alone have
// a zero-bit promise; derived vertices retain rational position checks.
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
  assert.equal(F, 7);
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

function count(report,expected){exactData([report.sourceCompilationCount,report.bindingObservationCount,report.totalD1Count],expected);if(Object.hasOwn(report,'retries'))assert.equal(report.retries,0);}
const qEqual=(a,b)=>a.n*b.d===b.n*a.d;
const qDiv=(a,b)=>{assert.notEqual(b.n,0n);return {n:a.n*b.d,d:a.d*b.n};};
const pointEqual=(a,b)=>a.every((value,i)=>qEqual(value,b[i]));
const pointData=value=>value.map(fraction);
const sourceKey=source=>[source.operand,source.sourceId,source.faceId,source.surfaceId,source.loopId].join('|');
const sourceRef=(operand,asset)=>({operand,sourceId:asset.sourceId,faceId:asset.face.options.faceId,surfaceId:asset.face.plane.id,loopId:asset.face.loop.id});
function plane(support){const normal=support.outwardNormal.map(fraction),first=normal.find(value=>value.n!==0n);assert.ok(first);const magnitude={n:first.n<0n?-first.n:first.n,d:first.d};return [...normal,fraction(support.offset)].map(value=>qDiv(value,magnitude));}
const samePlane=(a,b)=>a.every((value,i)=>qEqual(value,b[i]));
export function proveIntersection(native,translated,tool,translation){
  exactData(native.request.left,translated);exactData(native.request.right,tool);assert.notEqual(native.request.left,translated);assert.notEqual(native.request.right,tool);
  assert.equal(native.outcome.kind,'solid');assert.equal(native.contact.dimension,3);exactData(native.contact.nodes,[]);
  const solid=native.outcome.solid,parents={left:translated,right:tool},allSources=[];
  for(const [operand,parent]of Object.entries(parents))for(const asset of parent.request.assets)allSources.push({source:sourceRef(operand,asset),asset,support:parent.supports.find(s=>s.sourceId===asset.sourceId&&s.faceId===asset.face.options.faceId)});
  const findSource=ref=>{const found=allSources.filter(item=>sourceKey(item.source)===sourceKey(ref));assert.equal(found.length,1);assert.ok(found[0].support);return found[0];};
  const nodeMap=new Map(native.lineage.nodes.map(node=>[node.key,node]));assert.equal(nodeMap.size,native.lineage.nodes.length);
  assert.equal(native.lineage.nodes.length,solid.graph.vertices.length);
  for(const node of native.lineage.nodes){
    const p=pointData(node.exactPointMM),matches=solid.graph.vertices.filter(vertex=>pointEqual(vertex.pointMM.map(binary64),p));assert.equal(matches.length,1);
    const incident=[];
    for(const {source,support}of allSources){const distance=add(dot(support.outwardNormal.map(fraction),p),{...fraction(support.offset),n:-BigInt(support.offset.numerator)});
      assert.ok(distance.n*distance.d<=0n,'every exact output vertex is inside both complete operands');if(distance.n===0n)incident.push(source);}
    exactData(sorted(node.supports),sorted(incident));assert.ok(incident.length>=3);
    assert.equal(node.key,[native.request.options.operationId,'vertex',...incident.map(sourceKey).sort()].join('|'));
  }
  const consumedSources=new Set(),trace=[];
  assert.equal(native.lineage.faces.length,solid.request.assets.length);
  for(const mapping of native.lineage.faces){
    const output=solid.request.assets.filter(asset=>asset.sourceId===mapping.output.sourceId);assert.equal(output.length,1);const asset=output[0],face=asset.face;
    exactData(mapping.output,{sourceId:asset.sourceId,faceId:face.options.faceId,surfaceId:face.plane.id,loopId:face.loop.id});assert.equal(face.sourceVersion,0);
    const targetSupport=solid.supports.find(s=>s.sourceId===asset.sourceId&&s.faceId===face.options.faceId);assert.ok(targetSupport);
    const expectedSources=allSources.filter(item=>samePlane(plane(item.support),plane(targetSupport))).map(item=>item.source);
    exactData(sorted(mapping.sources),sorted(expectedSources));assert.ok(mapping.sources.length>0);
    for(const source of mapping.sources){findSource(source);consumedSources.add(sourceKey(source));if(source.operand==='left'){
      const link=translation.lineage.faces.filter(link=>link.translated.sourceId===source.sourceId&&link.translated.faceId===source.faceId&&link.translated.surfaceId===source.surfaceId&&link.translated.loopId===source.loopId);assert.equal(link.length,1);
      trace.push({intersectionFace:mapping.output,translatedOperand:source,seedFace:link[0].original});}}
    const chosen=findSource(mapping.sources[0]).asset.face;exactData(face.plane,chosen.plane);assert.equal(face.loop.id,chosen.loop.id);assert.equal(face.options.faceId,chosen.options.faceId);assert.equal(face.options.orientation,chosen.options.orientation);
    assert.equal(mapping.edges.length,face.topology.loop.uses.length);
    for(const edge of mapping.edges){
      const uses=face.topology.loop.uses.filter(use=>use.id===edge.useId);assert.equal(uses.length,1);const use=uses[0];
      const curve=face.loop.edges.find(curve=>curve.id===use.curveId);assert.ok(curve);exactData([curve.degree,curve.knots,curve.weights],[1,[0,0,1,1],[1,1]]);
      const nodes=edge.nodeKeys.map(key=>{const node=nodeMap.get(key);assert.ok(node);return node;});assert.equal(nodes.length,2);
      const endpoints=use.vertexIds.map(id=>{const vertex=face.topology.vertices.find(v=>v.id===id);assert.ok(vertex);return vertex.point.map(binary64);});
      nodes.forEach((node,i)=>assert.ok(pointEqual(pointData(node.exactPointMM),endpoints[i])));
      const supporting=nodes[0].supports.filter(a=>nodes[1].supports.some(b=>sourceKey(a)===sourceKey(b)));exactData(sorted(edge.supportingSources),sorted(supporting));assert.ok(supporting.length>=2);
      const expectedOrigins=[];
      for(const {source,asset:originalAsset}of allSources)for(const originalUse of originalAsset.face.topology.loop.uses){
        const line=originalAsset.face.loop.edges.find(line=>line.id===originalUse.curveId);assert.ok(line);exactData([line.degree,line.knots,line.weights],[1,[0,0,1,1],[1,1]]);
        const start=line.controlPoints[0].map(binary64),end=line.controlPoints[1].map(binary64),direction=end.map((value,i)=>add(value,{...start[i],n:-start[i].n})),axis=direction.findIndex(value=>value.n!==0n);assert.ok(axis>=0);
        const parameters=endpoints.map(p=>qDiv(add(p[axis],{...start[axis],n:-start[axis].n}),direction[axis]));
        if(parameters.some(t=>t.n*t.d<0n||t.n*t.d>t.d*t.d))continue;
        if(!endpoints.every((p,i)=>pointEqual(p,start.map((value,j)=>add(value,mul(parameters[i],direction[j]))))))continue;
        expectedOrigins.push({...source,edgeId:originalUse.edgeId,useId:originalUse.id,curveId:originalUse.curveId,pcurveId:originalUse.pcurveId,domain:[0,1],parameters});
      }
      const originKey=origin=>signedData(Object.fromEntries(Object.entries(origin).filter(([key])=>key!=='sourceInterval'&&key!=='parameters')));
      exactData(edge.originalEdges.map(originKey).sort(),expectedOrigins.map(originKey).sort());
      for(const origin of edge.originalEdges){findSource(origin);const expected=expectedOrigins.filter(item=>originKey(item)===originKey(origin));assert.equal(expected.length,1);origin.sourceInterval.forEach((value,i)=>assert.ok(qEqual(fraction(value),expected[0].parameters[i])));}
      // A cut-created edge can have no original segment, but its complete
      // endpoint/support incidence and the new Native Line remain certified.
    }
  }
  exactData(sorted(native.lineage.discardedSources),sorted(allSources.map(item=>item.source).filter(source=>!consumedSources.has(sourceKey(source)))));
  assert.ok(native.lineage.faces.some(face=>new Set(face.sources.map(source=>source.operand)).size===2),'actual coincident support coverage includes both operands');
  const F=solid.request.assets.length,U=solid.request.assets.reduce((sum,asset)=>sum+asset.face.topology.loop.uses.length,0),report=native.report;
  exactData([report.schema,report.version,report.status,report.contactDimension],['barocss-convex-planar-solid-intersection',0,'solid',3]);
  assert.equal(report.boundaryProof,'all-original-facets-clipped-by-all-opposite-halfspaces-complete-coplanar-coverage');
  exactData(report.nativeWork,{parentReconstructions:2,outputQualifications:1,completeFaceReconstructions:13+F,newFaceConstructions:F,faceCompilations:13+2*F,
    sourceCompilations:13+2*F,bindingObservations:(54+2*U)*3,totalD1:(54+2*U)*9,retries:0,scope:'direct-calls-and-known-parent-loops-not-provider-internals'});
  assert.equal(report.exactWork.contextCount,4);assert.equal(report.exactWork.qualifiers.length,3);assert.ok(report.exactWork.aggregateOperations<=800000&&report.exactWork.aggregateGcdSteps<=800000&&report.exactWork.maximumObservedBits<=8192);
  assert.equal(report.validationScope,'whole-result-self-consistency-not-authenticity');assert.equal(report.numericPolicy,'exact-stored-binary64-native-admission-no-welding');assert.equal(report.persistentNamingCertified,false);
  assert.equal(report.memoryAccounting,'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap');deepFrozen(native);
  return {bothActualQualifiedOperands:true,completeExactSupportIncidence:true,allOutputFacetsAndDirectedEdgesBound:true,completeOriginalEdgeIntervals:true,
    translatedOperandSeedTrace:trace,nativeWork:report.nativeWork,lineageSHA256:dataHash(native.lineage),nativeSHA256:dataHash(native)};
}
export function proveSnapshot(snapshot,parameters=DEFAULTS){
  assert.equal(snapshot.save(),signedData(authoredDocument(parameters))+'\n');exactData(snapshot.parameters,parameters);exactData(snapshot.suppression,{});
  exactData(Object.keys(snapshot.bodies).sort(),['original','overlap','tool','translated']);
  const original=snapshot.bodies.original.native,tool=snapshot.bodies.tool.native,translated=snapshot.bodies.translated.native,overlap=snapshot.bodies.overlap.native;
  const translation=snapshot.evidence[4].native,intersection=snapshot.evidence[5].native;
  for(const body of Object.values(snapshot.bodies))assert.equal(body.family,'convex-planar');
  proveConvex(original,7168,[7,15,10]);proveConvex(tool,4096,[6,12,8]);proveConvex(translated,7168,[7,15,10]);
  const volume=parameters.offsetX===8?2944:2304,inventory=parameters.offsetX===8?[7,15,10]:[6,12,8];assert.ok(parameters.offsetX===8||parameters.offsetX===16);proveConvex(overlap,volume,inventory);
  assert.equal(translated,translation.solid);assert.equal(overlap,intersection.outcome.solid);exactData(snapshot.evidence[1].native.request.sketch,snapshot.evidence[0].native);exactData(snapshot.evidence[3].native.request.sketch,snapshot.evidence[2].native);
  count(snapshot.evidence[1].native.report.childNativeWork,[15,180,540]);count(snapshot.evidence[3].native.report.childNativeWork,[13,144,432]);
  const copy=proveTranslation(translation,original,[parameters.offsetX,0,0]),clipping=proveIntersection(intersection,translated,tool,translation);
  const bounds=solid=>({min:[0,1,2].map(i=>Math.min(...solid.graph.vertices.map(v=>v.pointMM[i]))),max:[0,1,2].map(i=>Math.max(...solid.graph.vertices.map(v=>v.pointMM[i])))});
  const boundsMM=Object.fromEntries(Object.entries(snapshot.bodies).map(([label,body])=>[label,bounds(body.native)]));
  exactData(boundsMM.overlap,{min:[parameters.offsetX,0,0],max:[40,24,4]});exactData(boundsMM.translated,{min:[parameters.offsetX,0,0],max:[parameters.offsetX+32,32,8]});deepFrozen(snapshot);
  return {volumesMM3:{original:7168,tool:4096,translated:7168,overlap:volume},boundsMM,inventory,translation:copy,intersection:clipping,
    authoredSHA256:sha256(snapshot.save()),bodiesSHA256:dataHash(snapshot.bodies),evidenceSHA256:dataHash(snapshot.evidence),snapshotSHA256:dataHash(snapshotData(snapshot))};
}
export function proveRefusal(error,CadModelError,dimension){
  assert.ok(error instanceof CadModelError);assert.equal(error.code,'SELECTION');assert.equal(error.operation,'intersect');assert.equal(error.cause.contactDimension,dimension);
  assert.match(error.message,new RegExp('contact dimension '+dimension));assert.deepEqual(Object.keys(error.cause),['contactDimension']);assert.ok(Object.isFrozen(error.cause));
  for(const key of ['solid','bodies','evidence','lineage','report'])assert.equal(Object.hasOwn(error,key),false);
  return {code:error.code,operation:error.operation,contactDimension:dimension,noAcceptedReplacement:true,
    publicDiagnosticScope:'contact dimension only; failed translation/intersection reports are not exposed'};
}
export function provePreview(result, solid) {
  assert.notEqual(result.solid, solid); exactData(result.solid, solid); exactData(result.options, { maximumFanTriangles: 40 });
  const { mesh, report, boundaries, internalDiagonals } = result;
  assert.equal(report.schema, 'barocss-convex-planar-solid-mesh'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  exactData([report.faceCount, report.vertexCount, report.triangleCount, report.boundaryUseCount, report.internalDiagonalCount], [7, 30, 16, 30, 9]);
  exactData([mesh.faces.length, mesh.vertices.length, mesh.positionsMM.length, mesh.normals.length, mesh.parametersUV.length, mesh.indices.length], [7, 30, 90, 90, 60, 48]);
  exactData([boundaries.length, internalDiagonals.length], [30, 9]);
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 }); count(report.parentNativeWork, [7, 90, 270]);
  assert.equal(report.nativeAuthority, false); assert.equal(report.float32ProjectionCertified, false);
  const at = i => mesh.positionsMM.slice(i * 3, i * 3 + 3), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0); let sixVolume = 0;
  for (const [i, vertex] of mesh.vertices.entries()) {
    const face = faceAt(solid, vertex); assert.equal(face.plane.id, vertex.surfaceId);
    const use = face.topology.loop.uses.find(u => u.id === vertex.useId), native = face.topology.vertices.find(v => v.id === vertex.nativeVertexId); assert.ok(use && native);
    assert.equal(use.vertexIds[0], native.id); exactData(at(i), native.point);
    exactData(at(i), solid.graph.vertices.find(v => v.id === vertex.solidVertexId).pointMM);
    const binding = face.bindings.find(b => b.useId === use.id && b.parameter === use.interval[0]); assert.ok(binding);
    exactData(mesh.normals.slice(i * 3, i * 3 + 3), binding.orientedFaceNormal);
    const curve = face.pcurves.find(p => p.id === use.pcurveId).curve;
    exactData(mesh.parametersUV.slice(i * 2, i * 2 + 2), curve.controlPoints[use.sense === 'forward' ? 0 : 1].slice(0, 2));
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3); assert.ok(indices.every(j => Number.isInteger(j) && j >= 0 && j < 30));
    const [a, b, c] = indices.map(at), normal = mesh.normals.slice(indices[0] * 3, indices[0] * 3 + 3);
    assert.ok(dot(cross(b.map((v, j) => v - a[j]), c.map((v, j) => v - a[j])), normal) > 0); sixVolume += dot(a, cross(b, c));
  }
  equal({ n: BigInt(sixVolume), d: 6n }, fraction(solid.certificate.volumeMM3));
  for (const b of boundaries) {
    assert.equal(b.role, 'native-boundary'); const edge = solid.graph.edges.find(e => e.id === b.solidEdgeId); assert.ok(edge);
    exactData([...edge.vertexIds].sort(), [...b.solidVertexIds].sort()); exactData(b.vertexIndices.map(i => mesh.vertices[i].solidVertexId), b.solidVertexIds);
  }
  for (const d of internalDiagonals) {
    assert.equal(d.role, 'display-internal-not-brep-edge'); const ids = d.vertexIndices.map(i => mesh.vertices[i].solidVertexId).sort();
    assert.equal(solid.graph.edges.some(e => [...e.vertexIds].sort().join(':') === ids.join(':')), false);
  }
  return { faces: 7, vertices: 30, triangles: 16, outwardTriangleVolumeMM3: sixVolume / 6,
    parentNativeWork: report.parentNativeWork, previewSHA256: dataHash(result), basis: 'actual authored XYZ; no conversion' };
}

export const emptyLedgers=()=>({sketches:[],prisms:[],parents:[],targets:[],initialFaces:[],intersections:[],previews:[]});
export function collectLedgers(ledgers,snapshot,label){
  for(const index of snapshot.recomputation.evaluatedFeatures){const evidence=snapshot.evidence[index],entry=report=>({label,index,report});
    if(evidence.kind==='sketch')ledgers.sketches.push(entry(evidence.native.report));
    if(evidence.kind==='extrude')ledgers.prisms.push(entry(evidence.native.report.childNativeWork));
    if(evidence.kind==='translate'){ledgers.parents.push(entry(evidence.native.report.parentValidation.childNativeWork));ledgers.targets.push(entry(evidence.native.report.targetQualification.childNativeWork));ledgers.initialFaces.push(entry(evidence.native.report.initialFaceConstruction));}
    if(evidence.kind==='intersect')ledgers.intersections.push(entry(evidence.native.report.nativeWork));
  }
}
export function accounting(ledgers,counts){
  const keys=['sketches','prisms','parents','targets','initialFaces','intersections','previews'];exactData(keys.map(key=>ledgers[key].length),counts);
  const work=entries=>entries.reduce((sum,{report})=>sum.map((value,i)=>value+report[Object.hasOwn(report,'sourceCompilations')?['sourceCompilations','bindingObservations','totalD1'][i]:['sourceCompilationCount','bindingObservationCount','totalD1Count'][i]]),[0,0,0]);
  const returned=work(keys.filter(key=>key!=='sketches'&&key!=='initialFaces').flatMap(key=>ledgers[key])),initial=work(ledgers.initialFaces),available=returned.map((value,i)=>value+initial[i]+(i===0?ledgers.sketches.length:0));
  return {returnedLedgerSourceCompilations:returned[0],returnedLedgerBindingObservations:returned[1],returnedLedgerD1:returned[2],
    knownAvailableSourceCompilations:available[0],knownAvailableBindingObservations:available[1],knownAvailableD1:available[2],
    availableTranslationInitialFaces:ledgers.initialFaces.reduce((sum,{report})=>sum+report.faceCount,0),standaloneSketches:ledgers.sketches.length,
    publicRefusalReportScope:'contact dimensions only; no invented failed-frame ledgers',fullTransitiveNativeCoverage:'NOT_MEASURED'};
}
export function recorder(mode,entry,directory,source){
  assert.equal(Number(process.versions.node.split('.')[0]),22);assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv,process.env.NODE_OPTIONS??''].join(' '),/--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);assert.equal(process.argv.length,2);assert.ok(mode==='source'||mode==='cold');
  mkdirSync(directory,{recursive:true});const start=performance.now(),receipt=resolve(directory,mode+'-flow.json');
  const flow={status:'running',issue:2002,mode,processId:process.pid,processInstanceId:randomUUID(),nodeVersion:process.version,startedAt:new Date().toISOString(),
    groupStartedAtMS:source?.groupStartedAtMS??Date.now(),entrySHA256:sha256(readFileSync(entry)),modelCalls:0,tessellations:0,massQueries:0,exports:0,standaloneValidators:0,cpuBufferPreparations:0,
    stages:[],artifacts:{},returnedLedgers:emptyLedgers(),nativeElapsedMS:0,expectedWholeCampaign:EXPECTED_CAMPAIGN,sourceDerivedExpectedWorkIsNotInstrumented:true,
    fullTransitiveNativeCoverage:'NOT_MEASURED',timingScope:'stage action and raw persistence; not isolated kernel timing',limits:{heapMiB:1536,freeDiskMiB:500,processGroupSeconds:600},externalSerialProcessGroupTimeoutRequired:true};
  writeFileSync(receipt,signedData(flow)+'\n',{flag:'wx'});const write=()=>writeFileSync(receipt,signedData(flow)+'\n');
  const artifact=(name,value,scope,raw=false)=>{const bytes=raw?value:signedData(value)+'\n';assert.ok(Buffer.byteLength(bytes)<=32*1024*1024);writeFileSync(resolve(directory,name),bytes,{flag:'wx'});flow.artifacts[name]={bytes:Buffer.byteLength(bytes),sha256:sha256(bytes),scope};write();return bytes;};
  const budget=()=>{const disk=statfsSync(directory);assert.ok(disk.bavail*disk.bsize>=500*1024*1024);assert.ok(Date.now()-flow.groupStartedAtMS<600000&&flow.nativeElapsedMS+(source?.nativeElapsedMS??0)<600000);};
  const stage=(kind,label,action,filename)=>{budget();assert.ok(flow[kind]<(kind==='modelCalls'?mode==='source'?5:1:mode==='source'?1:0));flow[kind]++;flow.pending={kind,label};write();const begin=performance.now();let outcome='threw',failure;
    try{let result;try{result=action();outcome='returned';}catch(error){failure=errorData(error);artifact(filename+'.refusal.json',failure,'actual complete public error/cause before refusal oracle; failed Native reports are not exposed');throw error;}
      artifact(filename,kind==='modelCalls'?snapshotData(result):result,'actual complete result before fixture oracles');
      if(kind==='modelCalls')collectLedgers(flow.returnedLedgers,result,label);else flow.returnedLedgers.previews.push({label,report:result.report.parentNativeWork});return result;
    }finally{const elapsedMS=performance.now()-begin;flow.nativeElapsedMS+=elapsedMS;flow.stages.push({kind,label,outcome,elapsedMS,...(failure?{failure}:{})});flow.pending=null;write();}};
  const fail=error=>{flow.status='failed';flow.failure=errorData(error);flow.failedAt=new Date().toISOString();write();};
  const finish=()=>{budget();flow.status='passed';flow.completedAt=new Date().toISOString();flow.wallElapsedMS=performance.now()-start;write();};return {flow,artifact,stage,fail,finish};
}
