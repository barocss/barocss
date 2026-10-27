import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import type { CadDocumentResult, BaroCadDocumentPrimitiveOptionsV2,
  BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveEntryV2 } from '@barocss/cad-interop/document';
import type { BaroCadParseOptions } from '@barocss/cad-interop/native';
import { preparePrimitiveSceneFrame } from '@barocss/gpu';
import type { MeshCamera, MeshLighting, MeshMaterialBinding, PrimitiveSceneEntryV2,
  PrimitiveSceneMaterial, PreparedPrimitiveSceneFrame } from '@barocss/gpu';
import type { ViewerGeometryRef, ViewerRef, ViewerGeometryMotionState,
  ViewerGeometryMotionBinding, ViewerPoseFrame, ViewerPose,
  ViewerNativeSceneReplacementV0, ViewerSurfaceMaterial } from './index.js';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export interface ViewerNativeSceneAppearanceContext { mmToSceneUnit: number; background: Vec3 }
export interface ViewerNativeSceneAppearanceInputV1 {
  version: 1;
  source: { kind: 'document'; result: CadDocumentResult;
    options: BaroCadDocumentPrimitiveOptionsV2; bindings: BaroCadDocumentPrimitiveBindingV2[] };
  display: { motion: ViewerNativeSceneReplacementV0['display']['motion'];
    visibleGeometry: ViewerGeometryRef[]; camera: MeshCamera };
  appearance: { lighting: MeshLighting; materials: ViewerSurfaceMaterial[] };
}
export interface PreparedViewerNativeSceneAppearance {
  format: 'barocss-viewer-native-scene-appearance';
  version: 0;
  context: ViewerNativeSceneAppearanceContext;
  source: ViewerNativeSceneAppearanceInputV1['source'];
  inventory: ViewerGeometryRef[];
  display: { motion: ViewerGeometryMotionState | null;
    visibleGeometry: ViewerGeometryRef[]; camera: MeshCamera };
  prepared: PreparedPrimitiveSceneFrame;
}

const PALETTE: Vec3[] = [[.14,.58,.86],[.95,.57,.22],[.36,.72,.49],[.72,.48,.87]];
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const MODEL_ID = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
const MOTION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PIN_FIELDS = ['documentId','documentRevision','nativeFrame','bodyId','assetId',
  'assetRevision','sourceFrame','modelId','geometryKind','geometryId'];
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RangeError('Viewer native scene appearance: ' + message);
}

/** One shared outer budget; no caller getter or coercion is used. */
function snapshotPair(input: unknown, context: unknown): [unknown, unknown] {
  let remaining = 327680;
  const active = new Set<object>();
  const text = (value: string): void => check(value.length <= 262144
    && new TextEncoder().encode(value).length <= 262144, 'string budget exceeded');
  const visit = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, 'own value/depth budget exceeded');
    if (typeof value === 'number') { check(Number.isFinite(value), 'own numbers must be finite'); return value; }
    if (typeof value === 'string') { text(value); return value; }
    if (value === null || typeof value === 'boolean') return value;
    check(typeof value === 'object', 'plain own JSON data required');
    const array = Array.isArray(value);
    check(Object.getPrototypeOf(value) === (array ? Array.prototype : Object.prototype),
      'current-realm ordinary records and arrays required');
    check(!active.has(value), 'cyclic own data is unsupported');
    active.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, 'length');
        check(length && 'value' in length && Number.isInteger(length.value)
          && length.value >= 0 && length.value <= 4096, 'array length budget exceeded');
        const keys = Reflect.ownKeys(value);
        check(keys.length === length.value + 1 && keys.every(key => key === 'length'
          || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value),
        'arrays must be dense own data');
        const owned: unknown[] = [];
        for (let i = 0; i < length.value; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
          check(descriptor && 'value' in descriptor && descriptor.enumerable, 'array entries must be own data');
          owned.push(visit(descriptor.value, depth + 1));
        }
        return owned;
      }
      const keys = Reflect.ownKeys(value);
      check(keys.length <= 64, 'record field budget exceeded');
      const owned: Record<string, unknown> = {};
      for (const key of keys) {
        check(typeof key === 'string', 'symbol fields are unsupported'); text(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        check(descriptor && 'value' in descriptor && descriptor.enumerable, 'record fields must be own data');
        Object.defineProperty(owned, key, { value: visit(descriptor.value, depth + 1),
          enumerable: true, writable: true, configurable: true });
      }
      return owned;
    } finally { active.delete(value); }
  };
  const pair: [unknown, unknown] = [visit(input, 0), visit(context, 0)];
  try { structuredClone(input); structuredClone(context); }
  catch (cause) { throw new RangeError('Viewer native scene appearance: original input cannot be copied', { cause }); }
  return pair;
}
function record(input: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    label + ' must be a plain record');
  const keys = Object.keys(input);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), label + ' has missing or unsupported fields');
  return input as Record<string, unknown>;
}
function list(input: unknown, minimum: number, maximum: number, label: string): unknown[] {
  check(Array.isArray(input) && input.length >= minimum && input.length <= maximum, label + ' length is unsupported');
  return input;
}
function number(input: unknown, minimum: number, maximum: number, label: string): number {
  check(typeof input === 'number' && Number.isFinite(input) && input >= minimum && input <= maximum,
    label + ' is outside its finite range'); return input;
}
function vector(input: unknown, minimum: number, maximum: number, label: string): Vec3 {
  return list(input, 3, 3, label).map(value => number(value, minimum, maximum, label)) as Vec3;
}
function motionId(input: unknown): string {
  check(typeof input === 'string' && MOTION_ID.test(input), 'bounded Motion identifier required'); return input;
}
function surfaceRef(input: unknown): ViewerRef {
  const value = record(input, ['modelId','surfaceId'], 'Surface ref');
  check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'bounded display modelId required');
  check(typeof value.surfaceId === 'string' && ID.test(value.surfaceId), 'bounded original Surface ID required');
  return { modelId: value.modelId, surfaceId: value.surfaceId };
}
function geometryRef(input: unknown): ViewerGeometryRef {
  check(input !== null && typeof input === 'object', 'Geometry ref required');
  const kind = (input as Record<string, unknown>).kind;
  if (kind === 'surface') {
    const value = record(input, ['kind','modelId','surfaceId'], 'Surface geometry ref');
    return { kind: 'surface', ...surfaceRef({ modelId: value.modelId, surfaceId: value.surfaceId }) };
  }
  check(kind === 'curve', 'Geometry ref must be Surface or Curve');
  const value = record(input, ['kind','modelId','curveId'], 'Curve geometry ref');
  check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'bounded display modelId required');
  check(typeof value.curveId === 'string' && ID.test(value.curveId), 'bounded original Curve ID required');
  return { kind: 'curve', modelId: value.modelId, curveId: value.curveId };
}
function key(ref: ViewerGeometryRef): string {
  return JSON.stringify(ref.kind === 'surface' ? ['surface',ref.modelId,ref.surfaceId] : ['curve',ref.modelId,ref.curveId]);
}
function documentOptions(input: unknown): BaroCadDocumentPrimitiveOptionsV2 {
  check(input !== null && typeof input === 'object', 'Document options required');
  const options = record(input, Object.hasOwn(input, 'bodyIds') ? ['native','basis','bodyIds'] : ['native','basis'], 'Document options');
  check(options.basis === 'authored-xyz-matches-rhyup', 'explicit authored XYZ basis required');
  check(options.native !== null && typeof options.native === 'object', 'Native options required');
  const hasCurves = Object.hasOwn(options.native, 'curveDisplay');
  const value = record(options.native, hasCurves
    ? ['sourceVersion','countU','countV','unitsPerMillimeter','curveDisplay']
    : ['sourceVersion','countU','countV','unitsPerMillimeter'], 'Native options');
  check(value.sourceVersion === 0 && value.unitsPerMillimeter === 1, 'Native sourceVersion0 and unitsPerMillimeter1 required');
  const countU = number(value.countU, 2, 17, 'countU'), countV = number(value.countV, 2, 17, 'countV');
  check(Number.isInteger(countU) && Number.isInteger(countV), 'Native grid counts must be integers');
  const native: BaroCadParseOptions = { sourceVersion: 0, countU, countV, unitsPerMillimeter: 1 };
  if (hasCurves) {
    check(value.curveDisplay !== null && typeof value.curveDisplay === 'object', 'Curve options required');
    const wide = Object.hasOwn(value.curveDisplay, 'version');
    const curve = record(value.curveDisplay, wide
      ? ['version','chordToleranceMM','maxSegments','maxDepth'] : ['chordToleranceMM','maxSegments','maxDepth'], 'Curve options');
    if (wide) check(curve.version === 1, 'Only Curve display version1 is supported');
    const chordToleranceMM = number(curve.chordToleranceMM, 1e-7, 1000, 'Curve tolerance');
    const maxSegments = number(curve.maxSegments, 1, wide ? 4092 : 1024, 'Curve segments');
    const maxDepth = number(curve.maxDepth, 0, 16, 'Curve depth');
    check(Number.isInteger(maxSegments) && Number.isInteger(maxDepth), 'Curve budgets must be integers');
    native.curveDisplay = wide ? { version: 1, chordToleranceMM, maxSegments, maxDepth }
      : { chordToleranceMM, maxSegments, maxDepth };
  }
  let bodyIds: string[] | undefined;
  if (Object.hasOwn(options, 'bodyIds')) {
    bodyIds = list(options.bodyIds, 1, 4, 'bodyIds').map(value => {
      check(typeof value === 'string', 'bodyId must be text'); return value;
    });
    check(new Set(bodyIds).size === bodyIds.length, 'Duplicate bodyIds');
  }
  return { native, basis: 'authored-xyz-matches-rhyup', ...(bodyIds ? { bodyIds } : {}) };
}
function motion(input: unknown, inventory: ViewerGeometryRef[]): ViewerGeometryMotionState | null {
  if (input === null) return null;
  const value = record(input, ['basis','frame','bindings'], 'Geometry Motion');
  check(value.basis === 'part-xyz-matches-rhyup', 'explicit Motion XYZ basis required');
  const frameValue = record(value.frame, ['contextId','timeSeconds','poses'], 'Motion frame');
  const contextId = motionId(frameValue.contextId), timeSeconds = number(frameValue.timeSeconds, 0, 3600, 'Motion time');
  const poses: ViewerPose[] = list(frameValue.poses, 1, 4, 'Motion poses').map(raw => {
    check(raw !== null && typeof raw === 'object', 'Motion pose required');
    const fields = Object.keys(raw);
    check(fields.includes('targetId') && fields.every(field => ['targetId','translation','rotation','scale'].includes(field)), 'Motion pose fields unsupported');
    const pose = record(raw, fields, 'Motion pose');
    let rotation: Quat | undefined;
    if (Object.hasOwn(pose, 'rotation')) {
      rotation = list(pose.rotation, 4, 4, 'Motion rotation').map(value => number(value, -1, 1, 'Motion rotation')) as Quat;
      check(Math.abs(Math.hypot(...rotation) - 1) <= 1e-9, 'Motion rotation must be a unit quaternion');
    }
    return { targetId: motionId(pose.targetId),
      ...(Object.hasOwn(pose, 'translation') ? { translation: vector(pose.translation, -10000, 10000, 'Motion translation') } : {}),
      ...(rotation ? { rotation } : {}),
      ...(Object.hasOwn(pose, 'scale') ? { scale: vector(pose.scale, .001, 100, 'Motion scale') } : {}) };
  });
  check(new Set(poses.map(pose => pose.targetId)).size === poses.length, 'Duplicate Motion target');
  const bindings: ViewerGeometryMotionBinding[] = list(value.bindings, inventory.length, inventory.length, 'Motion bindings').map(raw => {
    const binding = record(raw, ['contextId','targetId','ref'], 'Motion binding');
    const bindingContext = motionId(binding.contextId);
    check(bindingContext === contextId, 'Motion binding context differs');
    return { contextId: bindingContext, targetId: motionId(binding.targetId), ref: geometryRef(binding.ref) };
  });
  const targets = new Set(bindings.map(binding => binding.targetId)), refs = new Set(bindings.map(binding => key(binding.ref)));
  check(targets.size === inventory.length && refs.size === inventory.length && poses.length === inventory.length
    && poses.every(pose => targets.has(pose.targetId)) && inventory.every(ref => refs.has(key(ref))), 'Motion must cover every admitted geometry once');
  const frame: ViewerPoseFrame = { contextId, timeSeconds, poses };
  const poseMap = new Map(poses.map(pose => [pose.targetId, pose]));
  return { basis: 'part-xyz-matches-rhyup', frame, bindings, displayPoses: bindings.map(binding => {
    const pose = poseMap.get(binding.targetId)!;
    return { ref: binding.ref, translation: pose.translation ?? [0,0,0],
      rotationXYZW: pose.rotation ?? [0,0,0,1], scale: pose.scale ?? [1,1,1] };
  }) };
}

/** Pure canonical native-document and appearance admission; no Viewer instance or presentation. */
export function prepareViewerNativeSceneAppearance(input: unknown, context: unknown): PreparedViewerNativeSceneAppearance {
  const [ownedInput, ownedContext] = snapshotPair(input, context);
  const envelope = record(ownedInput, ['version','source','display','appearance'], 'Request');
  check(envelope.version === 1, 'Only appearance input version1 is supported');
  const contextValue = record(ownedContext, ['mmToSceneUnit','background'], 'Context');
  const contextOwned: ViewerNativeSceneAppearanceContext = {
    mmToSceneUnit: number(contextValue.mmToSceneUnit, 1e-6, 1, 'Context mmToSceneUnit'),
    background: vector(contextValue.background, 0, 1, 'Context background') };
  const source = record(envelope.source, ['kind','result','options','bindings'], 'Source');
  check(source.kind === 'document', 'Only canonical document source is supported');
  const options = documentOptions(source.options);
  const expected = list(source.bindings, 1, 4, 'TEN bindings').map(pin => record(pin, PIN_FIELDS, 'TEN binding'));
  check(new Set(expected.map(pin => pin.bodyId)).size === expected.length, 'Duplicate TEN binding bodyId');
  const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(source.result as CadDocumentResult, options);
  check(projected.length === expected.length && projected.every(entry => expected.some(pin =>
    PIN_FIELDS.every(field => Object.is(pin[field], entry.binding[field as keyof BaroCadDocumentPrimitiveBindingV2])))),
  'TEN bindings differ from freshly rebuilt original authority');
  const surfaces: Extract<BaroCadDocumentPrimitiveEntryV2, { kind: 'surface' }>[] = [];
  const curves: Exclude<BaroCadDocumentPrimitiveEntryV2, { kind: 'surface' }>[] = [];
  for (const entry of projected) { if (entry.kind === 'surface') surfaces.push(entry); else curves.push(entry); }
  check(projected.length >= 1 && projected.length <= 4, 'Native inventory must contain1..4 objects');
  let vertices = 0, indices = 0, curvePoints = 0, curveSegments = 0;
  for (const entry of surfaces) { vertices += entry.packet.positions.length / 3; indices += entry.packet.indices.length; }
  check(vertices <= 4096 && indices <= 24576, 'Native Surface totals exceed Viewer capacities');
  for (const entry of curves) {
    check(entry.sampleVersion === 0 || entry.sampleVersion === 1, 'Viewer Curve sample0 or1 required');
    check(entry.sampleVersion === curves[0].sampleVersion, 'Viewer requires one Curve sample version');
    const points = entry.sample.pointsMM.length;
    check(points >= 2 && points <= (entry.sampleVersion === 1 ? 4097 : 1025), 'Curve sample exceeds Viewer capacity');
    curvePoints += points; curveSegments += points - 1;
  }
  check(curvePoints <= 16388 && curveSegments <= 16384, 'Native Curve totals exceed Viewer capacities');
  const inventory: ViewerGeometryRef[] = [
    ...surfaces.map(entry => geometryRef({ kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId })),
    ...curves.map(entry => geometryRef({ kind: 'curve', modelId: entry.ref.modelId, curveId: entry.ref.geometryId })) ];
  const inventoryKeys = new Set(inventory.map(key));
  check(inventoryKeys.size === inventory.length, 'Duplicate native geometry ref');
  const display = record(envelope.display, ['motion','visibleGeometry','camera'], 'Display');
  const geometryMotion = motion(display.motion, inventory);
  const visible = list(display.visibleGeometry, 0, 4, 'Visibility').map(geometryRef), visibleKeys = new Set(visible.map(key));
  check(visibleKeys.size === visible.length && visible.every(ref => inventoryKeys.has(key(ref))), 'Visibility must be a unique admitted subset');
  const appearance = record(envelope.appearance, ['lighting','materials'], 'Appearance');
  record(appearance.lighting, ['ambientStrength','directionalStrength','direction'], 'Lighting');
  record(display.camera, ['eye','target','up','fovY','near','far'], 'Explicit camera');
  const materials: PrimitiveSceneMaterial[] = list(appearance.materials, 0, 4, 'Materials').map(raw => {
    const value = record(raw, ['ref','binding'], 'Surface material'), ref = surfaceRef(value.ref);
    check(visibleKeys.has(key({ kind: 'surface', ...ref })), 'Material target must be a visible candidate Surface');
    record(value.binding, ['material','uniforms'], 'Material binding');
    return { ref: { modelId: ref.modelId, geometryId: ref.surfaceId }, binding: value.binding as MeshMaterialBinding };
  });
  check(new Set(materials.map(value => JSON.stringify(value.ref))).size === materials.length, 'Duplicate material target');
  const transform = (ref: ViewerGeometryRef) => {
    const pose = geometryMotion?.displayPoses.find(pose => key(pose.ref) === key(ref));
    return pose ? { transform: { translation: pose.translation, rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {};
  };
  const entries: PrimitiveSceneEntryV2[] = [
    ...surfaces.map((entry, index): PrimitiveSceneEntryV2 => ({ kind: 'surface', ref: { ...entry.ref },
      packet: entry.packet, color: [...PALETTE[index]] as Vec3, ...transform(inventory[index]) })),
    ...curves.map((entry, index): PrimitiveSceneEntryV2 => {
      const fields = { kind: 'curve' as const, ref: { ...entry.ref }, basis: 'authored-xyz-matches-rhyup' as const,
        color: [...PALETTE[(surfaces.length + index) % PALETTE.length]] as Vec3,
        ...transform(inventory[surfaces.length + index]) };
      return entry.sampleVersion === 1 ? { ...fields, sampleVersion: 1, sample: entry.sample }
        : { ...fields, sampleVersion: 0, sample: entry.sample };
    }) ];
  const full = preparePrimitiveSceneFrame({ version: 0, scene: { version: 2, entries },
    options: { mmToSceneUnit: contextOwned.mmToSceneUnit, translate: [0,0,0], background: contextOwned.background,
      camera: display.camera, lighting: appearance.lighting }, particles: null, materials });
  const prepared = visible.length === inventory.length ? full : preparePrimitiveSceneFrame({
    ...full.frame, scene: { version: 2, entries: full.frame.scene.entries.filter(entry => visibleKeys.has(key(
      entry.kind === 'surface' ? { kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId }
        : { kind: 'curve', modelId: entry.ref.modelId, curveId: entry.ref.geometryId }))) } },
  visible.length === 0 ? 'viewport-v2' : 'qualified-v2');
  check(prepared.frame.options.camera, 'Canonical explicit camera is missing');
  return { format: 'barocss-viewer-native-scene-appearance', version: 0,
    context: structuredClone(contextOwned),
    source: { kind: 'document', result: structuredClone(source.result) as CadDocumentResult,
      options: structuredClone(options), bindings: structuredClone(projected.map(entry => entry.binding)) },
    inventory: structuredClone(inventory), display: { motion: structuredClone(geometryMotion),
      visibleGeometry: structuredClone(visible), camera: structuredClone(prepared.frame.options.camera) }, prepared };
}
