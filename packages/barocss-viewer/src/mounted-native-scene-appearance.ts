import { prepareViewerNativeSceneAppearance } from './native-scene-appearance.js';
import type { PreparedViewerNativeSceneAppearance } from './native-scene-appearance.js';
import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import type { BaroCadDocumentPrimitiveBindingV2 } from '@barocss/cad-interop/document';
import type { AdaptiveCurveSamplingResult, WideAdaptiveCurveSamplingResult } from '@barocss/cad';
import type { MeshLighting } from '@barocss/gpu';
import type { ViewerPacket, ViewerDocumentBody, ViewerGeometryRef, ViewerSurfaceMaterial } from './index.js';

type NativeCurveEntry = { modelId: string } & (
  | { sampleVersion: 0; sample: AdaptiveCurveSamplingResult }
  | { sampleVersion: 1; sample: WideAdaptiveCurveSamplingResult });
interface MountedNativeSceneAppearanceCandidate {
  prepared: PreparedViewerNativeSceneAppearance;
  packets: ViewerPacket[];
  curves: NativeCurveEntry[];
  documentBodies: ViewerDocumentBody[];
  hiddenGeometry: ViewerGeometryRef[];
  surfaceMaterials: ViewerSurfaceMaterial[];
  lighting: MeshLighting;
}
const PIN_FIELDS: (keyof BaroCadDocumentPrimitiveBindingV2)[] = [
  'documentId','documentRevision','nativeFrame','bodyId','assetId','assetRevision',
  'sourceFrame','modelId','geometryKind','geometryId' ];
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RangeError('Viewer mounted native scene appearance: ' + message);
}
function geometryKey(ref: ViewerGeometryRef): string {
  return JSON.stringify(ref.kind === 'surface'
    ? ['surface',ref.modelId,ref.surfaceId] : ['curve',ref.modelId,ref.curveId]);
}

/** Stage all original CPU commit metadata; the instance alone presents and adopts it. */
export function prepareMountedNativeSceneAppearance(input: unknown, context: unknown): MountedNativeSceneAppearanceCandidate {
  const prepared = prepareViewerNativeSceneAppearance(input, context);
  // Visible execution views cannot supply hidden native authority. Rebuild all
  // selected originals from the complete owned document through public Interop.
  const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(prepared.source.result, prepared.source.options);
  const pins = projected.map(entry => entry.binding);
  check(pins.length === prepared.source.bindings.length
    && pins.every((pin, index) => PIN_FIELDS.every(field => Object.is(pin[field], prepared.source.bindings[index][field]))),
  'Rebuilt TEN bindings differ from the prepared complete document');
  const packets: ViewerPacket[] = [], curves: NativeCurveEntry[] = [], documentBodies: ViewerDocumentBody[] = [];
  for (const entry of projected) {
    const modelId = entry.ref.modelId, geometryId = entry.ref.geometryId;
    if (entry.kind === 'surface') {
      packets.push({ modelId, packet: structuredClone(entry.packet) });
      documentBodies.push({ ref: { kind: 'surface', modelId, surfaceId: geometryId },
        binding: structuredClone(entry.binding) });
    } else {
      check(entry.sampleVersion === 0 || entry.sampleVersion === 1, 'Only original Curve sample0 or1 is supported');
      curves.push(entry.sampleVersion === 1
        ? { modelId, sampleVersion: 1, sample: structuredClone(entry.sample) }
        : { modelId, sampleVersion: 0, sample: structuredClone(entry.sample) });
      documentBodies.push({ ref: { kind: 'curve', modelId, curveId: geometryId },
        binding: structuredClone(entry.binding) });
    }
  }
  const inventory: ViewerGeometryRef[] = [
    ...packets.map(entry => ({ kind: 'surface' as const, modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
    ...curves.map(entry => ({ kind: 'curve' as const, modelId: entry.modelId, curveId: entry.sample.curve.id })) ];
  check(inventory.length === prepared.inventory.length
    && inventory.every((ref, index) => geometryKey(ref) === geometryKey(prepared.inventory[index])),
  'Rebuilt original inventory differs from the prepared document');
  const visible = new Set(prepared.display.visibleGeometry.map(geometryKey));
  const hiddenGeometry = inventory.filter(ref => !visible.has(geometryKey(ref)));
  const surfaceMaterials: ViewerSurfaceMaterial[] = prepared.prepared.frame.materials.map(material => ({
    ref: { modelId: material.ref.modelId, surfaceId: material.ref.geometryId },
    binding: structuredClone(material.binding) }));
  const lighting = prepared.prepared.frame.options.lighting;
  check(lighting, 'Canonical explicit lighting is missing');
  return { prepared, packets, curves, documentBodies, hiddenGeometry: structuredClone(hiddenGeometry),
    surfaceMaterials, lighting: structuredClone(lighting) };
}
