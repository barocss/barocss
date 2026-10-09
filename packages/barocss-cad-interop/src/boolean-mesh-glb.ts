import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshResult } from '@barocss/cad';
import { encodeNativePreviewGlb } from './glb.js';
import type { PreparedCadMesh } from './packet.js';

export interface BaroCadBooleanDisplayGlbOptions {
  /** glTF positions are metres. This must be exactly 0.001 metre per native mm. */
  unitsPerMillimeter: 0.001;
  /** Host assertion that authored XYZ matches glTF's right-handed Y-up basis. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanDisplayGlbMapping {
  readonly componentId: string;
  readonly derivedNodeName: string;
  readonly gltfNodeIndex: number;
  readonly outerLoopId: string;
  readonly holeLoopIds: ReadonlyArray<string>;
  readonly vertexIndices: ReadonlyArray<number>;
  readonly triangleIds: ReadonlyArray<string>;
  readonly boundaryPathIds: ReadonlyArray<string>;
  readonly internalEdgeIds: ReadonlyArray<string>;
  readonly bridgeIds: ReadonlyArray<string>;
}

export interface BaroCadBooleanDisplayGlbReport {
  readonly schema: 'barocad-boolean-mesh-display-glb-report';
  readonly version: 1;
  readonly meshId: string;
  readonly evaluationId: string;
  readonly supportId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly operands: Readonly<{
    a: Readonly<CoplanarFaceBooleanMeshResult['mesh']['binding']['a']>;
    b: Readonly<CoplanarFaceBooleanMeshResult['mesh']['binding']['b']>;
  }>;
  readonly target: 'glb-derived-display';
  readonly sourceLengthUnit: 'mm';
  readonly outputLengthUnit: 'm';
  readonly sourceFrame: 'authored-xyz-no-axis-conversion';
  readonly basisAssertion: 'authored-xyz-matches-rhyup';
  readonly componentCount: number;
  readonly triangleCount: number;
  readonly outputBytes: number;
  readonly maximumOutputBytes: 1048576;
  readonly mappings: ReadonlyArray<BaroCadBooleanDisplayGlbMapping>;
  readonly preserved: ReadonlyArray<string>;
  readonly approximated: ReadonlyArray<string>;
  readonly omitted: ReadonlyArray<string>;
}

export interface BaroCadBooleanDisplayGlbResult {
  /** Owned, self-contained glTF 2.0 binary display asset. */
  readonly glb: ArrayBuffer;
  readonly report: BaroCadBooleanDisplayGlbReport;
}

const preserved = Object.freeze([
  'validated-native-component-triangle-indices-and-oriented-normals',
  'native-dimensionless-cad-uv-as-custom-_CAD_UV-not-texture-uv',
  'qualified-operand-source-component-loop-triangle-and-true-boundary-ids-in-extras',
  'display-internal-edges-and-bridges-distinct-from-cad-boundaries',
]);
const approximated = Object.freeze([
  'authored-xyz-mm-positions-rounded-to-float32-metres',
  'normals-and-cad-uv-rounded-to-float32',
  'json-numeric-metadata-normalizes-negative-zero',
]);
const omitted = Object.freeze([
  'editable-native-region-source-curves-surfaces-and-pcurves',
  'full-native-sample-and-validation-proof-records',
  'solid-brep-manufacturing-and-global-error-certification',
]);

function ownOptions(input: BaroCadBooleanDisplayGlbOptions): BaroCadBooleanDisplayGlbOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Boolean display GLB options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const scale = Object.getOwnPropertyDescriptor(input, 'unitsPerMillimeter');
  const basis = Object.getOwnPropertyDescriptor(input, 'basis');
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key)) ||
      !scale?.enumerable || !('value' in scale) || scale.value !== 0.001 ||
      !basis?.enumerable || !('value' in basis) ||
      basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Boolean display GLB requires metre scale and matching Y-up basis');
  }
  return { unitsPerMillimeter: 0.001, basis: basis.value };
}

function float32Data(values: number[], scale: number, label: string): Float32Array {
  const target = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const scaled = values[index] * scale;
    const value = Math.fround(scaled);
    if (!Number.isFinite(scaled) || !Number.isFinite(value) || (values[index] !== 0 && value === 0)) {
      throw new RangeError(`Boolean display GLB ${label} is not representable as Float32`);
    }
    target[index] = value;
  }
  return target;
}

function checkTriangles(indices: number[], positions: Float32Array, normals: Float32Array): void {
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = indices.slice(index, index + 3).map(value => value * 3);
    const ab = [0, 1, 2].map(axis => positions[b + axis] - positions[a + axis]);
    const ac = [0, 1, 2].map(axis => positions[c + axis] - positions[a + axis]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]];
    if (!Number.isFinite(Math.hypot(...cross)) || Math.hypot(...cross) === 0 ||
        [a, b, c].some(vertex => cross.reduce((sum, value, axis) =>
          sum + value * normals[vertex + axis], 0) <= 0)) {
      throw new RangeError('Boolean display GLB triangle collapses or flips in Float32 metres');
    }
  }
}

/** Export only validated native filled Boolean material as a portable display GLB. */
export function exportBaroCadBooleanDisplayGlb(
  result: CoplanarFaceBooleanMeshResult, options: BaroCadBooleanDisplayGlbOptions,
): BaroCadBooleanDisplayGlbResult {
  validateCoplanarFaceBooleanMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = float32Data(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = float32Data(owned.mesh.normals, 1, 'normal');
  const parameters = float32Data(owned.mesh.parametersUV, 1, 'CAD UV');
  const triangles = new Map(owned.triangulation.triangles.map(value => [value.id, value]));
  const meshes: PreparedCadMesh[] = [];
  const nodeMetadata: Record<string, unknown>[] = [];
  const mappings: BaroCadBooleanDisplayGlbMapping[] = [];
  for (const [index, component] of owned.triangulation.components.entries()) {
    const indices = component.triangleIds.flatMap(id => {
      const triangle = triangles.get(id);
      if (!triangle || triangle.componentId !== component.componentId) {
        throw new RangeError('Boolean display GLB triangle differs from native component');
      }
      return triangle.vertexIndices;
    });
    if (!indices.length || indices.some(value => value < 0 || value > 65535)) {
      throw new RangeError('Boolean display GLB component exceeds Uint16 indices');
    }
    checkTriangles(indices, positions, normals);
    const derivedNodeName = `barocad_boolean_${index}`;
    // The legacy writer field surfaceId is only its derived display node label here.
    // No packet0 or native Surface is created from the Boolean mesh.
    meshes.push({ surfaceId: derivedNodeName, revision: 0,
      positions: positions.slice(), normals: normals.slice(),
      parameters: parameters.slice(), indices: Uint16Array.from(indices) });
    const boundaryPaths = owned.boundaryPaths.filter(path => path.componentId === component.componentId)
      .map(path => ({ fragmentId: path.fragmentId, loopId: path.loopId, loopRole: path.loopRole,
        edgeId: path.edgeId, useId: path.useId, curveId: path.curveId, pcurveId: path.pcurveId,
        contributor: path.contributor, source: path.source, sense: path.sense,
        interval: path.interval, nativeInterval: path.nativeInterval,
        vertexIndices: path.vertexIndices, nativeVertexIds: path.nativeVertexIds }));
    const internalEdges = owned.triangulation.internalEdges.filter(edge =>
      edge.componentId === component.componentId);
    const bridges = owned.triangulation.bridges.filter(bridge =>
      bridge.componentId === component.componentId);
    const mapping: BaroCadBooleanDisplayGlbMapping = {
      componentId: component.componentId, derivedNodeName, gltfNodeIndex: index,
      outerLoopId: component.outerLoopId, holeLoopIds: [...component.holeLoopIds],
      vertexIndices: [...component.vertexIndices], triangleIds: [...component.triangleIds],
      boundaryPathIds: boundaryPaths.map(path => path.fragmentId),
      internalEdgeIds: internalEdges.map(edge => edge.id), bridgeIds: bridges.map(bridge => bridge.id),
    };
    mappings.push(mapping);
    nodeMetadata.push({ kind: 'native-coplanar-boolean-material-display',
      sourceRole: 'validated-native-coplanar-face-boolean-mesh', outputRole: 'derived-display-mesh',
      meshId: owned.mesh.id, evaluationId: owned.mesh.binding.evaluationId,
      supportId: owned.mesh.binding.supportId, operands: {
        a: owned.mesh.binding.a, b: owned.mesh.binding.b },
      sourceAssetIds: owned.mesh.binding.sourceAssetIds,
      sourceLengthUnit: 'mm', displayLengthUnit: 'm', sourceFrame: owned.report.sourceFrame,
      basisAssertion: request.basis, parameterAttribute: '_CAD_UV',
      parameterMeaning: 'dimensionless-native-cad-uv-not-texture-uv',
      ...mapping, boundaryPaths, internalEdges, bridges });
  }
  if (mappings.length !== owned.report.componentCount ||
      mappings.reduce((sum, mapping) => sum + mapping.triangleIds.length, 0) !== owned.report.triangleCount) {
    throw new RangeError('Boolean display GLB omitted a native component or triangle');
  }
  const assetMetadata = {
    format: 'barocad-boolean-mesh-display-glb', version: 1,
    meshId: owned.mesh.id, evaluationId: owned.mesh.binding.evaluationId,
    supportId: owned.mesh.binding.supportId, operands: {
      a: owned.mesh.binding.a, b: owned.mesh.binding.b },
    sourceAssetIds: owned.mesh.binding.sourceAssetIds,
    sourceRole: 'validated-native-coplanar-face-boolean-mesh', outputRole: 'derived-display-mesh',
    sourceLengthUnit: 'mm', displayLengthUnit: 'm', sourceFrame: owned.report.sourceFrame,
    basisAssertion: request.basis, mappings,
    preserved, approximated, omitted,
  };
  const glb = encodeNativePreviewGlb(meshes, nodeMetadata, [], assetMetadata);
  const report: BaroCadBooleanDisplayGlbReport = {
    schema: 'barocad-boolean-mesh-display-glb-report', version: 1,
    meshId: owned.mesh.id, evaluationId: owned.mesh.binding.evaluationId,
    supportId: owned.mesh.binding.supportId,
    sourceAssetIds: [...owned.mesh.binding.sourceAssetIds],
    operands: { a: { ...owned.mesh.binding.a }, b: { ...owned.mesh.binding.b } },
    target: 'glb-derived-display', sourceLengthUnit: 'mm', outputLengthUnit: 'm',
    sourceFrame: 'authored-xyz-no-axis-conversion', basisAssertion: request.basis,
    componentCount: mappings.length, triangleCount: owned.report.triangleCount,
    outputBytes: glb.byteLength, maximumOutputBytes: 1048576,
    mappings, preserved, approximated, omitted,
  };
  return { glb, report };
}
