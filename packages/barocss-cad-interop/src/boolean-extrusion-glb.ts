import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import { encodeNativePreviewGlb } from './glb.js';
import type { NativeGlbCurve } from './glb.js';
import type { PreparedCadMesh } from './packet.js';

type Face = CoplanarFaceBooleanExtrusionMeshResult['faceRanges'][number];
type Edge = CoplanarFaceBooleanExtrusionMeshResult['edgePaths'][number];

export interface BaroCadBooleanExtrusionDisplayGlbOptions {
  unitsPerMillimeter: 0.001;
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanExtrusionDisplayGlbShellMapping {
  readonly shellId: string;
  readonly componentId: string;
  readonly derivedNodeName: string;
  readonly gltfNodeIndex: number;
  readonly faceIds: ReadonlyArray<string>;
  readonly trueEdgeIds: ReadonlyArray<string>;
  readonly triangleIds: ReadonlyArray<string>;
  readonly internalEdgeIds: ReadonlyArray<string>;
}

export interface BaroCadBooleanExtrusionDisplayGlbEdgeMapping {
  readonly edgeId: string;
  readonly shellId: string;
  readonly curveId: string;
  readonly derivedNodeName: string;
  readonly gltfNodeIndex: number;
  readonly source: Readonly<Edge['source']>;
  readonly adjacentFaceIds: ReadonlyArray<string>;
}

export interface BaroCadBooleanExtrusionDisplayGlbReport {
  readonly schema: 'barocad-boolean-extrusion-display-glb-report';
  readonly version: 1;
  readonly meshId: string;
  readonly extrusionEvaluationId: string;
  readonly booleanEvaluationId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly target: 'glb-derived-display';
  readonly sourceLengthUnit: 'mm';
  readonly outputLengthUnit: 'm';
  readonly sourceFrame: 'authored-xyz-no-axis-conversion';
  readonly basisAssertion: 'authored-xyz-matches-rhyup';
  readonly shellCount: number;
  readonly faceCount: number;
  readonly trueEdgeCount: number;
  readonly triangleCount: number;
  readonly outputBytes: number;
  readonly maximumOutputBytes: 1048576;
  readonly shells: ReadonlyArray<BaroCadBooleanExtrusionDisplayGlbShellMapping>;
  readonly edges: ReadonlyArray<BaroCadBooleanExtrusionDisplayGlbEdgeMapping>;
  readonly preserved: ReadonlyArray<string>;
  readonly approximated: ReadonlyArray<string>;
  readonly omitted: ReadonlyArray<string>;
}

export interface BaroCadBooleanExtrusionDisplayGlbResult {
  readonly glb: ArrayBuffer;
  readonly report: BaroCadBooleanExtrusionDisplayGlbReport;
}

const preserved = Object.freeze([
  'validated-native-shell-face-triangle-indices-hard-normals-and-cad-uv',
  'native-shell-face-edge-curve-source-and-true-boundary-ids-in-extras',
  'display-internal-diagonals-and-bridges-distinct-from-true-curve-lines',
]);
const approximated = Object.freeze([
  'authored-xyz-mm-points-rounded-to-float32-metres',
  'native-curve-edges-shown-as-polylines-through-original-d1-samples',
  'normals-and-cad-uv-rounded-to-float32',
  'json-numeric-metadata-normalizes-negative-zero',
]);
const omitted = Object.freeze([
  'editable-native-curves-surfaces-trims-and-full-owned-validation-record',
  'exact-continuous-curve-between-saved-native-samples',
  'sewn-solid-volume-native-inverse-and-manufacturing-certification',
]);

function ownOptions(input: BaroCadBooleanExtrusionDisplayGlbOptions): BaroCadBooleanExtrusionDisplayGlbOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Shell GLB options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      fields.unitsPerMillimeter?.value !== 0.001 ||
      fields.basis?.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Shell GLB requires metre scale and matching Y-up basis');
  }
  return { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
}

function floatValues(values: ReadonlyArray<number>, scale: number, label: string): Float32Array {
  const output = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const converted = values[index] * scale;
    const value = Math.fround(converted);
    if (!Number.isFinite(converted) || !Number.isFinite(value) ||
        (values[index] !== 0 && value === 0)) {
      throw new RangeError(`Shell GLB ${label} is not Float32 representable`);
    }
    output[index] = value;
  }
  return output;
}

function checkTriangles(indices: ReadonlyArray<number>, positions: Float32Array, normals: Float32Array): void {
  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = indices.slice(offset, offset + 3).map(index => index * 3);
    const ab = [0, 1, 2].map(axis => positions[b + axis] - positions[a + axis]);
    const ac = [0, 1, 2].map(axis => positions[c + axis] - positions[a + axis]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]];
    if (!Number.isFinite(Math.hypot(...cross)) || Math.hypot(...cross) === 0 ||
        [a, b, c].some(vertex => cross.reduce((sum, value, axis) =>
          sum + value * normals[vertex + axis], 0) <= 0)) {
      throw new RangeError('Shell GLB triangle collapses or flips in Float32 metres');
    }
  }
}

function faceMetadata(face: Face): Record<string, unknown> {
  return { faceId: face.faceId, shellId: face.shellId, componentId: face.componentId,
    kind: face.kind, orientation: face.orientation, surfaceId: face.surfaceId, source: face.source,
    indexStart: face.indexStart, indexCount: face.indexCount,
    triangleIds: face.triangles.map(triangle => triangle.id),
    boundaryUseIds: face.boundaryIncidence.map(use => use.useId),
    internalEdges: face.internalEdges.map(edge => ({ id: edge.id, kind: edge.kind })) };
}

/** Export only the validated native Shell display mesh and sampled true Curves. */
export function exportBaroCadBooleanExtrusionDisplayGlb(
  result: CoplanarFaceBooleanExtrusionMeshResult, options: BaroCadBooleanExtrusionDisplayGlbOptions,
): BaroCadBooleanExtrusionDisplayGlbResult {
  validateCoplanarFaceBooleanExtrusionMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = floatValues(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = floatValues(owned.mesh.normals, 1, 'normal');
  const parameters = floatValues(owned.mesh.parametersUV, 1, 'CAD UV');
  checkTriangles(owned.mesh.indices, positions, normals);
  const meshes: PreparedCadMesh[] = [];
  const metadata: Record<string, unknown>[] = [];
  const curves: NativeGlbCurve[] = [];
  const shells: BaroCadBooleanExtrusionDisplayGlbShellMapping[] = [];
  const edges: BaroCadBooleanExtrusionDisplayGlbEdgeMapping[] = [];
  for (const [index, shell] of owned.shellRanges.entries()) {
    const faces = shell.faceRangeIndices.map(faceIndex => owned.faceRanges[faceIndex]);
    const indices = faces.flatMap(face => owned.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount));
    if (!indices.length || indices.some(value => value < 0 || value > 65535)) {
      throw new RangeError('Shell GLB triangle indices exceed Uint16 or are empty');
    }
    const derivedNodeName = `barocad_shell_${index}`;
    // The writer's legacy surfaceId field is only a derived glTF node label.
    // No native Surface or preview packet is created here.
    meshes.push({ surfaceId: derivedNodeName, revision: 0, positions: positions.slice(),
      normals: normals.slice(), parameters: parameters.slice(), indices: Uint16Array.from(indices) });
    const mapping: BaroCadBooleanExtrusionDisplayGlbShellMapping = {
      shellId: shell.shellId, componentId: shell.componentId, derivedNodeName, gltfNodeIndex: index,
      faceIds: faces.map(face => face.faceId), trueEdgeIds: shell.edgePathIndices.map(pathIndex => owned.edgePaths[pathIndex].edgeId),
      triangleIds: faces.flatMap(face => face.triangles.map(triangle => triangle.id)),
      internalEdgeIds: faces.flatMap(face => face.internalEdges.map(edge => edge.id)),
    };
    shells.push(mapping);
    metadata.push({ kind: 'native-boolean-extrusion-shell-display', outputRole: 'derived-display-mesh',
      meshId: owned.mesh.id, extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
      booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
      sourceAssetIds: owned.mesh.binding.sourceAssetIds, sourceLengthUnit: 'mm', displayLengthUnit: 'm',
      sourceFrame: owned.report.sourceFrame, basisAssertion: request.basis,
      parameterAttribute: '_CAD_UV', parameterMeaning: 'dimensionless-native-cad-uv-not-texture-uv',
      ...mapping, faces: faces.map(faceMetadata), holeLoopIds: shell.holeLoopIds });
  }
  for (const [index, path] of owned.edgePaths.entries()) {
    const points = floatValues(path.samples.flatMap(sample => sample.curveD1.point),
      request.unitsPerMillimeter, 'Curve sample');
    if (points.length !== 9) throw new RangeError('Shell GLB expects three native Curve D1 samples');
    for (let point = 3; point < points.length; point += 3) {
      if (points[point] === points[point - 3] && points[point + 1] === points[point - 2] &&
          points[point + 2] === points[point - 1]) {
        throw new RangeError('Shell GLB Curve segment collapses in Float32 metres');
      }
    }
    const parameters = path.samples.map(sample => sample.parameter);
    const derivedNodeName = `barocad_true_edge_${index}`;
    const mapping: BaroCadBooleanExtrusionDisplayGlbEdgeMapping = {
      edgeId: path.edgeId, shellId: path.shellId, curveId: path.curveId,
      derivedNodeName, gltfNodeIndex: owned.shellRanges.length + index,
      source: { ...path.source }, adjacentFaceIds: path.adjacentFaces.map(face => face.faceId),
    };
    edges.push(mapping);
    curves.push({ curveId: derivedNodeName, positions: points, parameters,
      intervals: [[parameters[0], parameters[1]], [parameters[1], parameters[2]]],
      nodeMetadata: { kind: 'native-true-curve-sample-display', outputRole: 'derived-display-polyline',
        meshId: owned.mesh.id, componentId: path.componentId, edgeKind: path.kind,
        nativeInterval: path.interval, nativeVertexIds: path.nativeVertexIds,
        nativeFragmentId: path.nativeFragmentId, nativeVertexId: path.nativeVertexId,
        ...mapping, adjacentFaces: path.adjacentFaces.map(face => ({ faceId: face.faceId,
          loopId: face.loopId, useId: face.useId, pcurveId: face.pcurveId })) } });
  }
  if (shells.length !== owned.report.shellRangeCount || edges.length !== owned.report.edgePathCount ||
      shells.reduce((sum, shell) => sum + shell.faceIds.length, 0) !== owned.report.faceRangeCount ||
      shells.reduce((sum, shell) => sum + shell.triangleIds.length, 0) !== owned.report.triangleCount) {
    throw new RangeError('Shell GLB omitted a native Shell, face, triangle or true Curve');
  }
  const assetMetadata = { format: 'barocad-boolean-extrusion-display-glb', version: 1,
    meshId: owned.mesh.id, extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
    booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
    sourceAssetIds: owned.mesh.binding.sourceAssetIds,
    sourceRole: 'validated-native-coplanar-face-boolean-extrusion-mesh',
    outputRole: 'derived-display-shells-and-true-curve-samples',
    sourceLengthUnit: 'mm', displayLengthUnit: 'm', sourceFrame: owned.report.sourceFrame,
    basisAssertion: request.basis, shells, edges, preserved, approximated, omitted };
  const glb = encodeNativePreviewGlb(meshes, metadata, curves, assetMetadata);
  const report: BaroCadBooleanExtrusionDisplayGlbReport = {
    schema: 'barocad-boolean-extrusion-display-glb-report', version: 1,
    meshId: owned.mesh.id, extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
    booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
    sourceAssetIds: [...owned.mesh.binding.sourceAssetIds], target: 'glb-derived-display',
    sourceLengthUnit: 'mm', outputLengthUnit: 'm',
    sourceFrame: 'authored-xyz-no-axis-conversion', basisAssertion: request.basis,
    shellCount: shells.length, faceCount: owned.report.faceRangeCount,
    trueEdgeCount: edges.length, triangleCount: owned.report.triangleCount,
    outputBytes: glb.byteLength, maximumOutputBytes: 1048576,
    shells, edges, preserved, approximated, omitted,
  };
  return { glb, report };
}
