import type { CadDocumentResult } from '@barocss/cad';
import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from './document.js';
import type { BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveOptionsV2,
  BaroCadDocumentPrimitiveRefV2 } from './document.js';
import { encodeNativePreviewGlb } from './glb.js';
import type { NativeGlbCurve } from './glb.js';
import { validateBaroCadParseOptions } from './native.js';
import { prepareCadPreviewMesh } from './packet.js';
import type { PreparedCadMesh } from './packet.js';

export interface BaroCadDocumentGlbMappingV1 {
  readonly bodyId: string;
  readonly assetId: string;
  readonly assetRevision: number;
  readonly sourceModelId: string;
  readonly sourceGeometryId: string;
  readonly geometryKind: 'curve' | 'surface';
  readonly derivedNodeName: string;
  readonly gltfNodeIndex: number;
  readonly primitiveMode: 3 | 4;
  readonly ref: BaroCadDocumentPrimitiveRefV2;
  readonly curveSampleVersion?: 0 | 1;
  readonly curveDomain?: readonly [number, number];
}

export interface BaroCadDocumentDisplayGlbReportV1 {
  readonly schema: 'barocad-document-display-glb-report';
  readonly version: 1;
  readonly documentId: string;
  readonly documentRevision: number;
  readonly documentProfile: 'direct-geometry';
  readonly target: 'glb-derived-display';
  readonly outputRole: 'derived-display-mesh';
  readonly sourceRole: 'original-authored-native-source-text';
  readonly sourceLengthUnit: 'mm';
  readonly outputLengthUnit: 'm';
  readonly sourceFrame: 'authored-xyz-no-axis-conversion';
  readonly basisAssertion: 'authored-xyz-matches-rhyup';
  readonly selectedBodyCount: number;
  readonly outputBytes: number;
  readonly maximumOutputBytes: 1048576;
  readonly mappings: ReadonlyArray<BaroCadDocumentGlbMappingV1>;
  readonly preserved: readonly string[];
  readonly approximated: readonly string[];
  readonly omitted: readonly string[];
  readonly unsupported: readonly string[];
  readonly unselectedBodyIds: readonly string[];
}

export interface BaroCadDocumentDisplayGlbResultV1 {
  /** Owned self-contained glTF 2.0 binary display asset, never a native CAD document. */
  readonly glb: ArrayBuffer;
  readonly report: BaroCadDocumentDisplayGlbReportV1;
}

const preserved = Object.freeze([
  'selected-qualified-document-asset-body-native-identity-in-extras',
  'curve-native-parameters-and-intervals-as-display-metadata',
  'surface-native-uv-as-custom-_CAD_UV-attribute',
]);
const approximated = Object.freeze([
  'surface-tessellated-triangles', 'curve-sampled-line-strip',
  'positions-rounded-to-float32-metres', 'json-numeric-metadata-normalizes-negative-zero',
]);
const omitted = Object.freeze([
  'original-native-source-text', 'native-nurbs-knots-weights-control-points',
  'unselected-bodies', 'document-authoring-records-and-placements',
]);
const unsupported = Object.freeze([
  'editable-native-nurbs-roundtrip', 'topology-and-solid-certification',
  'assembly-placement', 'manufacturing-tolerance-certification',
]);

function curvePositions(points: number[][]): Float32Array {
  const positions = new Float32Array(points.length * 3);
  for (let index = 0; index < points.length; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const scaled = points[index][axis] * 0.001;
      const converted = Math.fround(scaled);
      if (!Number.isFinite(scaled) || !Number.isFinite(converted) || (scaled !== 0 && converted === 0)) {
        throw new RangeError('Document GLB Curve position is unsafe in Float32 metres');
      }
      positions[index * 3 + axis] = converted;
    }
    if (index > 0 && positions[index * 3] === positions[(index - 1) * 3] &&
        positions[index * 3 + 1] === positions[(index - 1) * 3 + 1] &&
        positions[index * 3 + 2] === positions[(index - 1) * 3 + 2]) {
      throw new RangeError('Document GLB Curve has a collapsed Float32 display segment');
    }
  }
  return positions;
}

function nodeMetadata(binding: BaroCadDocumentPrimitiveBindingV2,
  ref: BaroCadDocumentPrimitiveRefV2): Record<string, unknown> {
  return {
    documentId: binding.documentId, documentRevision: binding.documentRevision,
    bodyId: binding.bodyId, assetId: binding.assetId, assetRevision: binding.assetRevision,
    sourceModelId: binding.modelId, sourceGeometryId: binding.geometryId,
    geometryKind: binding.geometryKind, sourceFrame: binding.sourceFrame,
    basisAssertion: 'authored-xyz-matches-rhyup', ref: { ...ref },
    sourceRole: 'original-authored-native-source-text', outputRole: 'derived-display-mesh',
    sourceLengthUnit: 'mm', displayLengthUnit: 'm', approximate: true,
  };
}

/** Export only selected authoritative document bodies through the existing display GLB writer. */
export function exportBaroCadDocumentDisplayGlb(
  result: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2,
): BaroCadDocumentDisplayGlbResultV1 {
  const selected = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const native = validateBaroCadParseOptions(options.native);
  if (native.unitsPerMillimeter !== 0.001) {
    throw new RangeError('Document display GLB requires 0.001 metre per native millimetre');
  }
  const ownedDocument = structuredClone(result.document);
  const surfaces: { mesh: PreparedCadMesh; metadata: Record<string, unknown>; bodyId: string }[] = [];
  const curves: { curve: NativeGlbCurve; bodyId: string }[] = [];
  for (const entry of selected) {
    const name = `barocad_${entry.binding.bodyId}`;
    const metadata = nodeMetadata(entry.binding, entry.ref);
    if (entry.kind === 'surface') {
      const mesh = prepareCadPreviewMesh(entry.packet, 0.001);
      if (mesh.surfaceId !== entry.binding.geometryId) throw new RangeError('Document GLB Surface ID differs from native source');
      if (entry.packet.positions.some((value, index) => value !== 0 && mesh.positions[index] === 0)) {
        throw new RangeError('Document GLB Surface position underflows in Float32 metres');
      }
      surfaces.push({ mesh: { ...mesh, surfaceId: name }, metadata: {
        ...metadata, previewPacketVersion: 0, parameterAttribute: '_CAD_UV',
        parameterMeaning: 'original-native-u-v-not-texture-uv',
      }, bodyId: entry.binding.bodyId });
    } else {
      const sample = entry.sample;
      if (sample.curve.id !== entry.binding.geometryId) throw new RangeError('Document GLB Curve ID differs from native source');
      curves.push({ bodyId: entry.binding.bodyId, curve: {
        curveId: name, positions: curvePositions(sample.pointsMM),
        parameters: [...sample.parameters],
        intervals: sample.segments.map(segment => [...segment.domain] as [number, number]),
        ...(entry.sampleVersion === 1 ? { sampleVersion: 1 as const } : {}),
        nodeMetadata: { ...metadata, sampleVersion: entry.sampleVersion,
          nativeDomain: [...sample.domain] },
      } });
    }
  }
  const byBody = new Map<string, { index: number; mode: 3 | 4 }>();
  surfaces.forEach((surface, index) => byBody.set(surface.bodyId, { index, mode: 4 }));
  curves.forEach((curve, index) => byBody.set(curve.bodyId, { index: surfaces.length + index, mode: 3 }));
  const mappings: BaroCadDocumentGlbMappingV1[] = selected.map(entry => {
    const node = byBody.get(entry.binding.bodyId);
    if (!node) throw new RangeError('Document GLB selected body has no derived node');
    return {
      bodyId: entry.binding.bodyId, assetId: entry.binding.assetId,
      assetRevision: entry.binding.assetRevision, sourceModelId: entry.binding.modelId,
      sourceGeometryId: entry.binding.geometryId, geometryKind: entry.binding.geometryKind,
      derivedNodeName: `barocad_${entry.binding.bodyId}`, gltfNodeIndex: node.index,
      primitiveMode: node.mode, ref: { ...entry.ref },
      ...(entry.kind === 'curve' ? { curveSampleVersion: entry.sampleVersion,
        curveDomain: [...entry.sample.domain] as [number, number] } : {}),
    };
  });
  const selectedIds = new Set(mappings.map(mapping => mapping.bodyId));
  const unselectedBodyIds = ownedDocument.bodies.filter(body => !selectedIds.has(body.id)).map(body => body.id);
  const assetMetadata = {
    format: 'barocad-document-display-glb', version: 1,
    documentId: ownedDocument.documentId, documentRevision: ownedDocument.revision,
    documentProfile: 'direct-geometry', sourceRole: 'original-authored-native-source-text',
    outputRole: 'derived-display-mesh', sourceLengthUnit: 'mm', displayLengthUnit: 'm',
    sourceFrame: ownedDocument.nativeFrame, basisAssertion: 'authored-xyz-matches-rhyup',
    mappings, preserved: [...preserved], approximated: [...approximated],
    omitted: [...omitted], unsupported: [...unsupported], unselectedBodyIds,
  };
  const glb = encodeNativePreviewGlb(surfaces.map(value => value.mesh),
    surfaces.map(value => value.metadata), curves.map(value => value.curve), assetMetadata);
  const report: BaroCadDocumentDisplayGlbReportV1 = {
    schema: 'barocad-document-display-glb-report', version: 1,
    documentId: ownedDocument.documentId, documentRevision: ownedDocument.revision,
    documentProfile: 'direct-geometry', target: 'glb-derived-display',
    outputRole: 'derived-display-mesh', sourceRole: 'original-authored-native-source-text',
    sourceLengthUnit: 'mm', outputLengthUnit: 'm', sourceFrame: ownedDocument.nativeFrame,
    basisAssertion: 'authored-xyz-matches-rhyup', selectedBodyCount: selected.length,
    outputBytes: glb.byteLength, maximumOutputBytes: 1048576,
    mappings, preserved: [...preserved], approximated: [...approximated],
    omitted: [...omitted], unsupported: [...unsupported], unselectedBodyIds,
  };
  return { glb, report };
}
