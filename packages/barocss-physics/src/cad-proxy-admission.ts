import { compileCadModel } from '@barocss/cad';
import type { PhysicsBodyConfig, Vec3 } from './types.js';
import type { CadSurfaceProxy, CadSurfaceProxyRequest } from './cad-proxy-types.js';
import { ID } from './limits.js';
import { add } from './math.js';
import { proxyError, proxyFields, proxyFinite, proxyRecord, proxyVector } from './cad-proxy-validation.js';

const CAD_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function requestValues(value: unknown): CadSurfaceProxyRequest {
  const input = proxyRecord(value);
  proxyFields(input, ['sourceVersion', 'sourceRevision', 'modelId', 'surfaceId', 'kind', 'proxy',
    'massKg', 'initialOffsetM', 'minimumHalfExtentM']);
  if (input.sourceVersion !== 0) proxyError('INVALID_CONFIG', 'CAD proxy requires sourceVersion 0');
  if (typeof input.sourceRevision !== 'string' || !ID.test(input.sourceRevision)) {
    proxyError('INVALID_CONFIG', 'invalid source revision');
  }
  if (typeof input.modelId !== 'string' || !CAD_ID.test(input.modelId) ||
    typeof input.surfaceId !== 'string' || !CAD_ID.test(input.surfaceId)) {
    proxyError('INVALID_CONFIG', 'invalid native model or Surface ID');
  }
  if (input.kind !== 'dynamic' && input.kind !== 'static') proxyError('INVALID_CONFIG', 'invalid proxy body kind');
  if (input.proxy !== 'sphere' && input.proxy !== 'box') proxyError('INVALID_CONFIG', 'invalid proxy shape');
  if (input.kind === 'static' && (Object.hasOwn(input, 'massKg') || Object.hasOwn(input, 'initialOffsetM'))) {
    proxyError('INVALID_CONFIG', 'static proxy cannot declare mass or offset');
  }
  if (input.kind === 'dynamic') proxyFinite(input.massKg, 0.000001, 1000000, 'massKg');
  if (input.proxy === 'sphere' && Object.hasOwn(input, 'minimumHalfExtentM')) {
    proxyError('INVALID_CONFIG', 'sphere proxy cannot declare minimumHalfExtentM');
  }
  if (Object.hasOwn(input, 'minimumHalfExtentM')) {
    proxyFinite(input.minimumHalfExtentM, 0.0001, 1000, 'minimumHalfExtentM');
  }
  if (Object.hasOwn(input, 'initialOffsetM')) proxyVector(input.initialOffsetM, -1000, 1000, 'initialOffsetM');
  return input as unknown as CadSurfaceProxyRequest;
}

function controlBounds(points: Vec3[][]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const row of points) for (const point of row) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], point[axis]);
    max[axis] = Math.max(max[axis], point[axis]);
  }
  if ([...min, ...max].some((value) => !Number.isFinite(value))) {
    proxyError('INVALID_CONFIG', 'native Surface has invalid control bounds');
  }
  return { min, max };
}

export function admitCadSurfaceProxy(source: string, request: CadSurfaceProxyRequest): CadSurfaceProxy {
  if (typeof source !== 'string' || source.length < 1 || source.length > 65536) {
    proxyError('INVALID_CONFIG', 'CAD source length must be 1..65536 characters');
  }
  const input = requestValues(request);
  const bodyId = `${input.kind === 'dynamic' ? 'part' : 'fixture'}:${input.modelId}.${input.surfaceId}`;
  if (!ID.test(bodyId)) proxyError('INVALID_CONFIG', 'qualified Physics body ID exceeds bounds');
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) proxyError('INVALID_CONFIG', `CAD source refused: ${compiled.diagnostics[0]?.code ?? 'unknown'}`);
  if (compiled.model.name !== input.modelId) proxyError('INVALID_CONFIG', 'native model ID differs from selection');
  const native = compiled.model.objects.find((object) => object.id === input.surfaceId);
  if (!native || native.kind !== 'surface') proxyError('INVALID_CONFIG', 'selected native object is not a Surface');
  const sourceBoundsMM = controlBounds(native.controlPoints);
  const sourceCenterMM = sourceBoundsMM.min.map((low, axis) =>
    (low + sourceBoundsMM.max[axis]) / 2) as Vec3;
  const halfSpanM = sourceBoundsMM.min.map((low, axis) =>
    (sourceBoundsMM.max[axis] - low) / 2000) as Vec3;
  const centerM = sourceCenterMM.map((value) => value / 1000) as Vec3;
  const positionM = add(centerM, input.initialOffsetM ?? [0, 0, 0]);
  proxyVector(positionM, -10000, 10000, 'proxy positionM');
  const shape = input.proxy === 'sphere'
    ? { kind: 'sphere' as const, radiusM: Math.max(0.0001, Math.hypot(...halfSpanM)) }
    : { kind: 'box' as const, halfExtentsM: halfSpanM.map((value) =>
      Math.max(value, input.minimumHalfExtentM ?? 0.0001)) as Vec3 };
  if (shape.kind === 'sphere') proxyFinite(shape.radiusM, 0.0001, 1000, 'proxy radiusM');
  else shape.halfExtentsM.forEach((value, axis) =>
    proxyFinite(value, 0.0001, 1000, `proxy halfExtentsM[${axis}]`));
  const body: PhysicsBodyConfig = input.kind === 'dynamic'
    ? { id: bodyId, kind: 'dynamic', shape, positionM, velocityMps: [0, 0, 0],
      massKg: input.massKg!, restitution: 0 }
    : { id: bodyId, kind: 'static', shape, positionM, restitution: 0 };
  const lossLabel = input.proxy === 'sphere'
    ? 'Control-net enclosing sphere; native Surface geometry is not the collision shape.'
    : 'Control-net axis-aligned box with minimum thickness; native Surface geometry is not the collision shape.';
  const admitted: CadSurfaceProxy = { sourceSnapshot: source, sourceRevision: input.sourceRevision,
    modelId: input.modelId, surfaceId: input.surfaceId, bodyId,
    sourceCenterMM: [...sourceCenterMM],
    sourceBoundsMM: { min: [...sourceBoundsMM.min], max: [...sourceBoundsMM.max] },
    lossLabel, body };
  Object.freeze(admitted.sourceCenterMM);
  Object.freeze(admitted.sourceBoundsMM.min);
  Object.freeze(admitted.sourceBoundsMM.max);
  Object.freeze(admitted.sourceBoundsMM);
  Object.freeze(body.positionM);
  if (body.kind === 'dynamic') Object.freeze(body.velocityMps);
  if (body.shape.kind === 'box') Object.freeze(body.shape.halfExtentsM);
  Object.freeze(body.shape);
  Object.freeze(body);
  return Object.freeze(admitted);
}

export function assertCadProxyCurrent(proxy: CadSurfaceProxy, currentSource: string, currentRevision: string): void {
  if (currentSource !== proxy.sourceSnapshot || currentRevision !== proxy.sourceRevision) {
    proxyError('STALE_SOURCE', 'CAD proxy source changed; explicit re-admission is required');
  }
}
