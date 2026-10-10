import {
  editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit,
  surfaceDomain, evaluateSurface,
} from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';

export const CASE_KEYS = Object.freeze(['degree5', 'maximum']);
const prefixes = Object.freeze({
  degree5: 'actual_degree5_u_v_native_coordinates',
  maximum: 'actual_16_by_16_256_poles_1024_fields',
});
export const PINS = Object.freeze([
  ['actual_degree5_u_v_native_coordinates.complete-original.source0.css',1482,'583b5ab3b6fd62a40a980c03254bb85cc346f9ce99238c86bedfc0ec90e420a8'],
  ['actual_degree5_u_v_native_coordinates.complete-candidate.source0.css',1481,'ceb2a5843e2edd9bd3e313959ab155230c086073385a022ff33f57bb262d3ad8'],
  ['actual_degree5_u_v_native_coordinates.authored-request.json',1692,'18863dd92f2fb93584888301f7de77b7237ba6e277d387b821cbc418abbad83b'],
  ['actual_degree5_u_v_native_coordinates.owned-result.json',14821,'b477d15e27a12c70e17cf15b7c1877f557a87927da0f95ff2ede4f057676915b'],
  ['actual_16_by_16_256_poles_1024_fields.complete-original.source0.css',5822,'a64ad0ee7d3a70c3bc068ee76a85510662540bfc65d222b9c72e17fe8db075ed'],
  ['actual_16_by_16_256_poles_1024_fields.complete-candidate.source0.css',7870,'669974116a82e074a025c2d7988402424f899aacb0521076cca92e2a4a237ed1'],
  ['actual_16_by_16_256_poles_1024_fields.authored-request.json',25717,'3054b9931c7b9d7a81418d44815c5d57b2817838987acf47b7d90e36e79d54e5'],
  ['actual_16_by_16_256_poles_1024_fields.owned-result.json',242280,'d55819ed7794ce49fd7f070f66301f7acf7959e89530180c5caa18b315d118a2'],
].map(([name,bytes,sha256]) => Object.freeze({ file:'wide-source-surface-three-data/'+name, bytes, sha256 })));

export function createNativeOptions() { return { sourceVersion:0, countU:17, countV:9, unitsPerMillimeter:.001 }; }
export function requireFact(condition, message) { if (!condition) throw new Error(message); }
export function sameNative(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a,b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor || a.length !== b.length) return false;
    return Array.from(a).every((value,index) => Object.is(value,b[index]));
  }
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && sameNative(a[key],b[key]));
}
export function assertNative(a,b,message='Whole native values/bits differ') { requireFact(sameNative(a,b),message); }
export function assertBuffer(a,b,message='Buffer values/bits differ') { requireFact(a.length===b.length && Array.from(a).every((value,index)=>Object.is(value,b[index])),message); }
export function stringifyNative(value, space=2) {
  // The example serializes admitted CPU data only. This is not a public codec.
  return JSON.stringify(value,(_key,item)=>typeof item==='number' && Object.is(item,-0) ? JSON.rawJSON('-0') : item,space)+'\n';
}
export function nativeCenters(model,id) {
  const surface=model.objects.find(object=>object.id===id && object.kind==='surface');
  requireFact(surface,'Selected native Surface missing');
  const domain=surfaceDomain(surface);
  return evaluateSurface(surface,domain.u[0]/2+domain.u[1]/2,domain.v[0]/2+domain.v[1]/2);
}
export async function loadCase(key,readText) {
  requireFact(CASE_KEYS.includes(key),'Unknown wide Surface family');
  const prefix=prefixes[key],pins=PINS.filter(pin=>pin.file.startsWith('wide-source-surface-three-data/'+prefix+'.'));
  // Pin order is declaration order, independent of asynchronous completion.
  const texts=await Promise.all(pins.map(pin=>readText(pin.file,pin)));
  const byFile=new Map(pins.map((pin,index)=>[pin.file,texts[index]]));
  const text=suffix=>byFile.get('wide-source-surface-three-data/'+prefix+'.'+suffix);
  return { key, pins:[...pins], originalSource:text('complete-original.source0.css'), candidateSource:text('complete-candidate.source0.css'), request:JSON.parse(text('authored-request.json')), owned:JSON.parse(text('owned-result.json')) };
}
function checkPatches(original,candidate,patches) {
  let rebuilt='',cursor=0;
  for(const patch of patches) {
    requireFact(patch.startUTF16>=cursor,'Patch intervals overlap');
    requireFact(original.slice(patch.startUTF16,patch.endUTF16)===patch.originalText,'Patch original literal differs');
    rebuilt+=original.slice(cursor,patch.startUTF16)+patch.replacementText;cursor=patch.endUTF16;
  }
  rebuilt+=original.slice(cursor);
  requireFact(rebuilt===candidate,'Whole patch/untouched source reconstruction differs');
}
export function proveCase(asset) {
  const before=structuredClone(asset);
  requireFact(asset.request.source===asset.originalSource,'Original complete request/source differs');
  const edit=editSourceSurfaceControlNetWide(asset.request);
  assertNative(edit,asset.owned,'Actual wide edit differs from saved whole result');
  requireFact(edit.source===asset.candidateSource,'Candidate complete source differs');
  const validationReport=validateSourceSurfaceControlNetWideEdit(edit);
  assertNative(validationReport,asset.owned.report,'Actual wide whole report differs');
  checkPatches(asset.originalSource,asset.candidateSource,edit.patches);
  requireFact(edit.originalModel.objects.length===3 && edit.model.objects.length===3,'Whole mixed Model3 required');
  assertNative(edit.model.objects.map(object=>object.id),['context_curve','target_surface','context_plane']);
  for(const[index,object]of edit.originalModel.objects.entries()) if(object.id!=='target_surface') assertNative(edit.model.objects[index],object,'Unselected sibling changed');
  const originalSurface=edit.originalModel.objects[1];
  for(const key of ['degreeU','degreeV','knotsU','knotsV'])assertNative(edit.surface[key],originalSurface[key],'Native degree/knot bits changed');
  requireFact(edit.report.degrees.u===5 && edit.report.degrees.v===5,'Actual degree5 Surface required');
  requireFact(edit.report.observations.length===9 && edit.report.derivativeObservations.length===9,'Whole native D0/D1 observations required');
  requireFact(edit.report.directCounts.derivativeSuccessCount+edit.report.directCounts.derivativeRefusalCount===18,'Native D1 attempted union counts differ');
  requireFact(edit.patches.length===(asset.key==='maximum'?1024:4),'Frozen changed patch count differs');
  const originalNative=parseBaroCadSource(asset.originalSource,createNativeOptions());
  const candidateNative=parseBaroCadSource(asset.candidateSource,createNativeOptions());
  assertNative(originalNative.model,edit.originalModel);assertNative(candidateNative.model,edit.model);
  for(const native of [originalNative,candidateNative]) {
    requireFact(native.surfaces.length===2 && native.curves.length===0,'Two whole native Surfaces required');
    assertNative(native.unrenderedCurveIds,['context_curve']);
    for(const surface of native.surfaces) {
      requireFact(surface.packet.positions.length===459 && surface.packet.indices.length===768,'Native17x9 packet shape differs');
      assertBuffer(surface.mesh.positions,Float32Array.from(surface.packet.positions,value=>value*.001));
      assertBuffer(surface.mesh.normals,Float32Array.from(surface.packet.normals));
      assertBuffer(surface.mesh.parameters,Float32Array.from(surface.packet.parameters));
      assertBuffer(surface.mesh.indices,surface.packet.indices);
    }
  }
  assertNative(asset,before,'Caller asset changed during whole proof');
  return { edit, validationReport, originalModel:edit.originalModel, model:edit.model, observations:edit.report.observations, patchCount:edit.patches.length, centers:{original:[...edit.report.observations[4].beforePointMM],candidate:[...edit.report.observations[4].afterPointMM]}, unrenderedCurveIds:[...candidateNative.unrenderedCurveIds], originalNative, candidateNative };
}
