import type { CadEditorSplitSnapshot, CadEditorSplitDownload } from './split-types.js';
import type { SolidSplitSceneReceipt } from './split-scene.js';

/** Private, bounded transport. Native authority and prepared GPU resources never cross it. */
export const SPLIT_WORKER_PROTOCOL = 'barocss-cad-editor-split-worker' as const;
export const SPLIT_WORKER_FILE_LIMIT = 2097152;
export const SPLIT_WORKER_DISPLAY_LIMIT = 16 * 1024 * 1024;
export interface SplitWorkerIdentity {
  protocol: typeof SPLIT_WORKER_PROTOCOL; version: 0; workspaceId: string;
  requestId: number; epoch: number; generation: number; displayGeneration: number;
}
export interface SplitWorkerSummary {
  cutY: number; presentation: { kind: 'original' | 'split' };
  generation: number; displayGeneration: number; pending: { cutY?: string };
  history: CadEditorSplitSnapshot['history']; dirty: boolean;
  downloadStatus: CadEditorSplitSnapshot['downloadStatus']; disposed: boolean;
}
export type SplitWorkerDisplay = Pick<SolidSplitSceneReceipt,
  'presentationKind' | 'scene' | 'bodies' | 'qualifications' | 'basis' | 'textureUV'>;
export type SplitWorkerCommand = SplitWorkerIdentity & (
  { type: 'INIT'; text: string; initialPresentation: 'original' | 'split' }
  | { type: 'PREPARE_APPLY' | 'PREPARE_UNDO' | 'PREPARE_REDO' | 'DISCARD' | 'SERIALIZE' | 'DISPOSE' }
  | { type: 'PREPARE_OPEN'; text: string }
  | { type: 'STAGE'; cutY: string }
  | { type: 'ACCEPT'; token: string; rendererAdmitted: true }
  | { type: 'CANCEL'; targetEpoch: number }
  | { type: 'MARK_DOWNLOADED'; token: string }
);
export interface SplitWorkerError { name: string; code: string; message: string; cause?: SplitWorkerError }
export type SplitWorkerReply = SplitWorkerIdentity & (
  { type: 'INIT_READY'; summary: SplitWorkerSummary; display: SplitWorkerDisplay }
  | { type: 'CANDIDATE'; token: string; kind: 'apply' | 'open' | 'undo' | 'redo'; summary: SplitWorkerSummary; display: SplitWorkerDisplay }
  | { type: 'ACK'; summary: SplitWorkerSummary | null; cancelled: boolean }
  | { type: 'SERIALIZED'; summary: SplitWorkerSummary; download: CadEditorSplitDownload }
  | { type: 'ERROR'; error: SplitWorkerError; unchanged: boolean; cancelled: boolean }
);
const identityKeys = ['protocol', 'version', 'workspaceId', 'requestId', 'epoch', 'generation', 'displayGeneration', 'type'];
function demand(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(`Split worker protocol: ${message}`); }
function record(value: unknown): asserts value is Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), 'plain data record required');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    demand(typeof key === 'string' && descriptor.enumerable && 'value' in descriptor, 'own enumerable data fields required');
  }
}
function fields(value: unknown, expected: string[]): asserts value is Record<string, unknown> {
  record(value); const keys = Object.keys(value);
  demand(keys.length === expected.length && expected.every(key => Object.hasOwn(value, key)), 'unexpected or missing fields');
}
function integer(value: unknown, maximum = 1_000_000_000): asserts value is number {
  demand(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum, 'bounded nonnegative integer required');
}
function string(value: unknown, maximum: number, nonempty = false): asserts value is string {
  demand(typeof value === 'string' && value.length <= maximum && (!nonempty || value.length > 0), 'bounded text required');
}
function token(value: unknown) { string(value, 128, true); demand(/^[a-zA-Z0-9_-]+$/.test(value), 'invalid token'); }
export function validateSplitWorkerText(value: unknown): asserts value is string {
  string(value, SPLIT_WORKER_FILE_LIMIT, true);
  demand(new TextEncoder().encode(value).length <= SPLIT_WORKER_FILE_LIMIT, 'file UTF8 budget exceeded');
}
/** Traversal is bounded before renderer/native admission, without trusting getters or JSON hooks. */
export function validateSplitWorkerData(value: unknown, maximum = SPLIT_WORKER_DISPLAY_LIMIT): void {
  let size16 = 0, size8 = 0, nodes = 0; const encoder = new TextEncoder(), ancestors = new Set<object>();
  const add = (text: string) => { size16 += text.length; size8 += encoder.encode(text).length;
    demand(size16 <= maximum && size8 <= maximum, 'complete DTO byte budget exceeded'); };
  const walk = (item: unknown, depth: number): void => {
    demand(depth <= 64 && ++nodes <= 1_000_000, 'DTO traversal budget exceeded');
    if (typeof item === 'string') { string(item, maximum); add(JSON.stringify(item)); return; }
    if (typeof item === 'number') { demand(Number.isFinite(item), 'finite number required'); add(Object.is(item, -0) ? '-0' : String(item)); return; }
    if (item === null || typeof item === 'boolean') { add(String(item)); return; }
    demand(typeof item === 'object' && !ancestors.has(item), 'acyclic ordinary data required'); ancestors.add(item);
    if (Array.isArray(item)) {
      demand(Object.getPrototypeOf(item) === Array.prototype && item.length <= 200_000 && Reflect.ownKeys(item).length === item.length + 1, 'dense bounded array required');
      add('['); for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        demand(descriptor && descriptor.enumerable && 'value' in descriptor, 'array data elements required');
        if (index) add(','); walk(descriptor.value, depth + 1);
      } add(']');
    } else { record(item); add('{'); Object.entries(item).forEach(([key, element], index) => {
      if (index) add(','); add(JSON.stringify(key)); add(':'); walk(element, depth + 1);
    }); add('}'); }
    ancestors.delete(item);
  }; walk(value, 0);
}
export function splitWorkerIdentity(value: SplitWorkerIdentity): SplitWorkerIdentity {
  return { protocol: value.protocol, version: value.version, workspaceId: value.workspaceId,
    requestId: value.requestId, epoch: value.epoch, generation: value.generation, displayGeneration: value.displayGeneration };
}
function identity(value: Record<string, unknown>) {
  demand(value.protocol === SPLIT_WORKER_PROTOCOL && value.version === 0, 'unsupported protocol/version');
  token(value.workspaceId); integer(value.requestId); demand(value.requestId > 0, 'positive request identity required');
  integer(value.epoch); integer(value.generation); integer(value.displayGeneration);
}
export function validateSplitWorkerCommand(value: unknown): asserts value is SplitWorkerCommand {
  record(value); identity(value);
  const extra: Record<string, string[]> = {
    INIT: ['text', 'initialPresentation'], PREPARE_APPLY: [], PREPARE_OPEN: ['text'], PREPARE_UNDO: [], PREPARE_REDO: [],
    STAGE: ['cutY'], DISCARD: [], ACCEPT: ['token', 'rendererAdmitted'], CANCEL: ['targetEpoch'], SERIALIZE: [], MARK_DOWNLOADED: ['token'], DISPOSE: [],
  };
  demand(typeof value.type === 'string' && Object.hasOwn(extra, value.type), 'unsupported command');
  fields(value, [...identityKeys, ...extra[value.type]]);
  if (value.type === 'INIT' || value.type === 'PREPARE_OPEN') validateSplitWorkerText(value.text);
  if (value.type === 'INIT') demand(value.initialPresentation === 'original' || value.initialPresentation === 'split', 'invalid initial presentation');
  if (value.type === 'STAGE') string(value.cutY, 128);
  if (value.type === 'ACCEPT' || value.type === 'MARK_DOWNLOADED') token(value.token);
  if (value.type === 'ACCEPT') demand(value.rendererAdmitted === true, 'renderer admission required');
  if (value.type === 'CANCEL') integer(value.targetEpoch);
}
function summary(value: unknown) {
  fields(value, ['cutY', 'presentation', 'generation', 'displayGeneration', 'pending', 'history', 'dirty', 'downloadStatus', 'disposed']);
  demand(typeof value.cutY === 'number' && Number.isFinite(value.cutY), 'invalid Cut Y');
  fields(value.presentation, ['kind']); demand(value.presentation.kind === 'original' || value.presentation.kind === 'split', 'invalid presentation');
  integer(value.generation); integer(value.displayGeneration);
  record(value.pending); fields(value.pending, Object.hasOwn(value.pending, 'cutY') ? ['cutY'] : []);
  if (Object.hasOwn(value.pending, 'cutY')) string(value.pending.cutY, 128);
  fields(value.history, ['index', 'count', 'bytesUTF8', 'bytesUTF16', 'canUndo', 'canRedo']);
  integer(value.history.index, 19); integer(value.history.count, 20);
  demand(value.history.count > 0 && value.history.index < value.history.count, 'invalid history position');
  integer(value.history.bytesUTF8, 64 * 1024 * 1024); integer(value.history.bytesUTF16, 64 * 1024 * 1024);
  demand(typeof value.history.canUndo === 'boolean' && typeof value.history.canRedo === 'boolean'
    && typeof value.dirty === 'boolean' && typeof value.disposed === 'boolean', 'boolean state required');
  demand(value.downloadStatus === 'Not downloaded' || value.downloadStatus === 'Download started', 'invalid download status');
}
function numbers(value: unknown, count: number, maximum = Infinity): asserts value is number[] {
  demand(Array.isArray(value) && value.length === count && value.every(item => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= maximum), 'bounded numeric array required');
}
function display(value: unknown) {
  fields(value, ['presentationKind', 'scene', 'bodies', 'qualifications', 'basis', 'textureUV']);
  demand(value.presentationKind === 'original' || value.presentationKind === 'split', 'invalid display kind');
  demand(value.basis === 'x,z,-y' && value.textureUV === 'derived-zero', 'invalid display conventions');
  demand(Array.isArray(value.bodies) && value.bodies.length === (value.presentationKind === 'original' ? 1 : 2), 'complete display bodies required');
  demand(Array.isArray(value.qualifications) && value.qualifications.length === value.bodies.length * 6, 'complete face qualifications required');
  const bodies = value.bodies, qualifications = value.qualifications;
  fields(value.scene, ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'background', 'camera', 'geometries', 'materials', 'nodes']);
  const scene = value.scene;
  demand(scene.format === 'barocss-gpu-engine-scene' && scene.version === 0 && scene.id === 'solid_split_scene'
    && scene.coordinateSystem === 'right-handed-y-up' && scene.positionUnit === 'scene', 'invalid scene format');
  numbers(scene.background, 3); fields(scene.camera, ['eye', 'target', 'up', 'fovYDegrees', 'near', 'far']);
  for (const key of ['eye', 'target', 'up']) numbers(scene.camera[key], 3);
  for (const key of ['fovYDegrees', 'near', 'far']) demand(typeof scene.camera[key] === 'number' && Number.isFinite(scene.camera[key]), 'invalid camera');
  demand(Array.isArray(scene.geometries) && scene.geometries.length === qualifications.length
    && Array.isArray(scene.nodes) && scene.nodes.length === bodies.length * 7
    && Array.isArray(scene.materials) && scene.materials.length === 1, 'bounded complete scene required');
  const geometries = scene.geometries, nodes = scene.nodes;
  const material = scene.materials[0]; fields(material, ['id', 'type', 'colorSpace', 'color']);
  demand(material.id === 'solid_split_material' && material.type === 'unlit' && material.colorSpace === 'linear', 'invalid material'); numbers(material.color, 3);
  const roles = ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax'];
  bodies.forEach((body, component) => {
    fields(body, ['componentId', 'bodyId', 'groupNodeId', 'bounds', 'faces']);
    const componentId = value.presentationKind === 'original' ? 'original' : `split_${component}`;
    const groupNodeId = `solid_${componentId}_group`;
    demand(body.componentId === componentId && body.groupNodeId === groupNodeId, 'invalid body identity'); string(body.bodyId, 128, true);
    fields(body.bounds, ['min', 'max']); numbers(body.bounds.min, 3); numbers(body.bounds.max, 3);
    demand(body.bounds.min.every((n, axis) => n <= (body.bounds as { max: number[] }).max[axis]), 'invalid body bounds');
    demand(Array.isArray(body.faces) && body.faces.length === 6, 'six body faces required');
    let renderVertices = 0;
    body.faces.forEach((face, index) => {
      fields(face, ['componentId', 'bodyId', 'groupNodeId', 'nodeId', 'geometryId', 'faceId', 'role', 'orientation', 'supportRef', 'authorityIndices', 'faceSampleIndices', 'triangleIndices', 'parametersUV', 'quantizationGapsMM']);
      const geometryId = `solid_${componentId}_geometry_${index}`, nodeId = `solid_${componentId}_node_${index}`;
      demand(face.componentId === componentId && face.bodyId === body.bodyId && face.groupNodeId === groupNodeId
        && face.geometryId === geometryId && face.nodeId === nodeId && face.role === roles[index], 'qualified face identity mismatch');
      string(face.faceId, 128, true); demand(face.orientation === 'forward' || face.orientation === 'reverse', 'invalid face orientation');
      fields(face.supportRef, ['sourceModelId', 'objectId']); string(face.supportRef.sourceModelId, 128, true); string(face.supportRef.objectId, 128, true);
      const geometry = geometries[component * 6 + index];
      fields(geometry, ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'winding', 'positions', 'normals', 'uvs', 'indices']);
      demand(geometry.format === 'barocss-gpu-triangle-geometry' && geometry.version === 0 && geometry.id === geometryId
        && geometry.coordinateSystem === 'right-handed-y-up' && geometry.positionUnit === 'scene' && geometry.winding === 'ccw', 'invalid qualified geometry');
      demand(Array.isArray(geometry.positions) && geometry.positions.length > 0 && geometry.positions.length % 3 === 0, 'complete positions required');
      const vertices = geometry.positions.length / 3; renderVertices += vertices;
      demand(vertices <= 1728 && renderVertices <= 1728, 'render vertex budget exceeded');
      numbers(geometry.positions, vertices * 3); numbers(geometry.normals, vertices * 3); numbers(geometry.uvs, vertices * 2);
      demand(geometry.uvs.every(n => n === 0), 'display texture UV must remain derived zero');
      demand(Array.isArray(geometry.indices) && geometry.indices.length > 0 && geometry.indices.length % 3 === 0 && geometry.indices.length <= 1728, 'bounded triangles required');
      for (const n of geometry.indices) integer(n, vertices - 1);
      for (const key of ['authorityIndices', 'faceSampleIndices', 'quantizationGapsMM']) numbers(face[key], vertices);
      for (const n of face.authorityIndices as number[]) integer(n, 289);
      for (const n of face.faceSampleIndices as number[]) integer(n, 389);
      demand((face.quantizationGapsMM as number[]).every(n => n >= 0), 'invalid quantization gap');
      numbers(face.parametersUV, vertices * 2); numbers(face.triangleIndices, geometry.indices.length / 3);
      for (const n of face.triangleIndices) integer(n, 575);
      // The repeated lookup table must carry precisely the body-owned qualification, never unrelated picks.
      demand(JSON.stringify(qualifications[component * 6 + index]) === JSON.stringify(face), 'qualification lookup mismatch');
    });
  });
  nodes.forEach((node, index) => {
    record(node); const group = index % 7 === 0, component = Math.floor(index / 7);
    fields(node, ['id', 'type', 'parentId', 'translation', 'rotationXYZW', 'scale', 'visible', ...(group ? [] : ['geometryId', 'materialId'])]);
    const body = bodies[component];
    demand(node.type === (group ? 'group' : 'mesh') && node.id === (group ? body.groupNodeId : body.faces[index % 7 - 1].nodeId)
      && node.parentId === (group ? null : body.groupNodeId) && node.visible === true, 'scene node identity mismatch');
    if (!group) demand(node.geometryId === body.faces[index % 7 - 1].geometryId && node.materialId === material.id, 'scene node geometry mismatch');
    numbers(node.translation, 3); numbers(node.rotationXYZW, 4); numbers(node.scale, 3);
  });
}
function errorRecord(value: unknown, depth = 0): void {
  record(value); fields(value, Object.hasOwn(value, 'cause') ? ['name', 'code', 'message', 'cause'] : ['name', 'code', 'message']);
  string(value.name, 64, true); string(value.code, 64, true); string(value.message, 1024, true);
  if (Object.hasOwn(value, 'cause')) { demand(depth < 2, 'bounded error cause chain required'); errorRecord(value.cause, depth + 1); }
}
export function validateSplitWorkerReply(value: unknown): asserts value is SplitWorkerReply {
  record(value); identity(value);
  const extra: Record<string, string[]> = { INIT_READY: ['summary', 'display'], CANDIDATE: ['token', 'kind', 'summary', 'display'],
    ACK: ['summary', 'cancelled'], SERIALIZED: ['summary', 'download'], ERROR: ['error', 'unchanged', 'cancelled'] };
  demand(typeof value.type === 'string' && Object.hasOwn(extra, value.type), 'unsupported reply');
  fields(value, [...identityKeys, ...extra[value.type]]);
  validateSplitWorkerData(value);
  if (value.type === 'ERROR') {
    errorRecord(value.error);
    demand(typeof value.unchanged === 'boolean' && typeof value.cancelled === 'boolean', 'error certainty required'); return;
  }
  if (value.type === 'ACK') { demand(typeof value.cancelled === 'boolean', 'cancel acknowledgement required'); if (value.summary === null) return; }
  summary(value.summary);
  if (value.type === 'INIT_READY' || value.type === 'CANDIDATE') display(value.display);
  if (value.type === 'CANDIDATE') { token(value.token); demand(['apply', 'open', 'undo', 'redo'].includes(value.kind as string), 'invalid candidate kind'); }
  if (value.type === 'SERIALIZED') { fields(value.download, ['token', 'text', 'suggestedFilename']); token(value.download.token);
    validateSplitWorkerText(value.download.text); string(value.download.suggestedFilename, 256, true); }
}
export function summarizeSplitWorkerState(state: CadEditorSplitSnapshot): SplitWorkerSummary {
  return { cutY: state.accepted.request.cutAsset.surface.controlPoints[0][0][1], presentation: { kind: state.presentation.kind },
    generation: state.generation, displayGeneration: state.displayGeneration, pending: { ...state.pending }, history: { ...state.history },
    dirty: state.dirty, downloadStatus: state.downloadStatus, disposed: state.disposed };
}
export function splitWorkerDisplay(receipt: SolidSplitSceneReceipt): SplitWorkerDisplay {
  return { presentationKind: receipt.presentationKind, scene: receipt.scene, bodies: receipt.bodies,
    qualifications: receipt.qualifications, basis: receipt.basis, textureUV: receipt.textureUV };
}

type WithoutIdentity<T> = T extends SplitWorkerIdentity ? Omit<T, keyof SplitWorkerIdentity> : never;
export type SplitWorkerRequestPayload = WithoutIdentity<SplitWorkerCommand>;
export function deserializeSplitWorkerError(error: SplitWorkerError): Error {
  const restore = (value: SplitWorkerError): Error => Object.assign(new Error(value.message, value.cause ? { cause: restore(value.cause) } : undefined), { name: value.name, code: value.code });
  return restore(error);
}
