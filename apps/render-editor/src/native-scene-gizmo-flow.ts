import {deriveRenderNativeSceneGizmoPose, prepareRenderNativeSceneGizmo, prepareRenderNativeSceneAppearance,
  parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, validateRenderNativeSceneDocument,
  prepareRenderSceneGizmo, deriveRenderSceneGizmoPatch, editRenderSceneObjectSource,
  inspectRenderSceneObjects, hitTestRenderSceneGizmo} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePose,
  RenderSceneGizmoMode, RenderSceneGizmoKey} from '@barocss/render-editor';
import {prepareCamera, prepareEngineScene} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneBase, createNativeSceneSeed, NATIVE_PREVIEW_CONTEXT} from './native-scene-seed';
import {createNativeSceneHost, assertNativeScenePreviewContext} from './native-scene-host';

/** CPU protocol evidence only. A private Node launcher owns bundles, graphs and real filesystem I/O. */
export interface NativeSceneGizmoFlowResult {
  readonly scope: string;
  readonly checks: readonly string[];
  readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string;
  readonly secondFileText?: string;
  readonly firstRevision?: number;
  readonly secondRevision?: number;
}
type XYZ = readonly [number, number, number];
type XY = readonly [number, number];
type Q = readonly [number, number, number, number];
const BODY = 'body_preview_b', OTHER = 'body_preview_a';
const viewport = {width: 900, height: 600, backingWidth: 1024, backingHeight: 768};
const camera: MeshCamera = {eye: [5, 4, 7], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const lighting = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const,
  profile: 'mesh-opaque-fragment-v0' as const, documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const scope = 'Actual public Native gizmo/appearance and private host CPU protocol; model callbacks are not Viewer/GL/pixel evidence. Files contain authored data, never execution IR.';
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function equal(actual: unknown, expected: unknown, label = 'value'): void {
  if (Object.is(actual, expected)) return;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') throw new Error(label + ' differs.');
  const left = Object.keys(actual), right = Object.keys(expected);
  check(left.length === right.length && left.every(key => right.includes(key)), label + ' fields differ.');
  for (const key of left) equal((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], label + '.' + key);
}
function close(actual: number, expected: number, tolerance = 1e-9): void {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}.`);
}
function refuses(operation: () => unknown): unknown {try {operation();} catch (error) {return error;} throw new Error('Expected a refusal.');}
function clone<T>(value: T): T {return structuredClone(value);}
function pose(document: RenderNativeSceneDocument, bodyId = BODY): RenderNativeScenePose {
  return document.display.poses.find(item => item.bodyId === bodyId)
    ?? {bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]};
}
function withPose(document: RenderNativeSceneDocument, next: RenderNativeScenePose): RenderNativeSceneDocument {
  const poses = (document.nativeOptions.bodyIds ?? document.nativeDocument.bodies.map(body => body.id))
    .map(bodyId => bodyId === next.bodyId ? next : pose(document, bodyId));
  return validateRenderNativeSceneDocument({...document, display: {...document.display, poses}});
}
function preserved(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument, allowLight = false): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'nativeDocument', 'nativeOptions', 'surfaceMaterials'] as const) equal(document[key], original[key], key);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'visibleBodyIds', 'basis'] as const) equal(document.display[key], original.display[key], 'display.' + key);
  if (!allowLight) equal(document.display.lighting, original.display.lighting, 'lighting');
  equal(pose(document, OTHER), pose(original, OTHER), 'unselected pose');
  for (const asset of document.nativeDocument.assets) check(asset.source === original.nativeDocument.assets.find(item => item.id === asset.id)?.source, 'Original CAD source changed.');
}
function cpu<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('CPU flow read browser global ' + key);}});
    }
    return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function multiplyQ(a: Q, b: Q): [number, number, number, number] {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
/** Independent quaternion vector application, not a provider rotation implementation. */
function rotate(q: Q, vector: XYZ): [number, number, number] {
  const length = Math.hypot(...q), normalized = q.map(value => value / length) as [number, number, number, number];
  return multiplyQ(multiplyQ(normalized, [...vector, 0]), [-normalized[0], -normalized[1], -normalized[2], normalized[3]]).slice(0, 3) as [number, number, number];
}
function geometrySanity(document: RenderNativeSceneDocument): void {
  const prepared = prepareRenderNativeSceneAppearance(document);
  equal(prepared.context, NATIVE_PREVIEW_CONTEXT, 'actual context');
  check(prepared.authored.entries.length === 2 && prepared.viewer.prepared.primitives.length === 2, 'Two authentic Surface entries required.');
  for (const entry of prepared.authored.entries) {
    check(entry.kind === 'surface', 'The genuine fixture must retain both original Surface entries.');
    const binding = entry.binding;
    check(binding.modelId === 'cloth_reference_981' && binding.geometryId === 'reference_panel', 'Original native model/Surface pin changed.');
    check(binding.assetRevision === (binding.bodyId === OTHER ? 2 : 7) && binding.documentRevision === 1, 'Original asset/document revisions changed.');
    const current = pose(document, binding.bodyId), primitive = prepared.viewer.prepared.primitives.find(item => {
      const ref = 'ref' in item.entry ? item.entry.ref : undefined;
      return ref?.modelId === entry.ref.modelId && ref.geometryId === entry.ref.geometryId;
    });
    check(primitive && primitive.normals, 'Actual prepared Surface display ref/normals missing.'); close(Math.hypot(...current.rotationXYZW), 1, 1e-9);
    for (let offset = 0; offset < entry.packet.positions.length; offset += 3) {
      const rotated = rotate(current.rotationXYZW, [0, 1, 2].map(axis => entry.packet.positions[offset + axis]! * current.scale[axis]!) as [number, number, number]);
      const normal = rotate(current.rotationXYZW, [0, 1, 2].map(axis => entry.packet.normals[offset + axis]! / current.scale[axis]!) as [number, number, number]);
      const norm = Math.hypot(...normal);
      for (let axis = 0; axis < 3; axis++) {
        close(primitive.positions[offset + axis]!, Math.fround((rotated[axis]! + current.translationMM[axis]!) * document.display.mmToSceneUnit), 2e-7);
        close(primitive.normals[offset + axis]!, Math.fround(normal[axis]! / norm), 2e-7);
      }
    }
  }
}
function projection(document: RenderNativeSceneDocument) {
  const original = pose(document), origin = original.translationMM.map(value => value * document.display.mmToSceneUnit) as [number, number, number];
  const matrices = prepareCamera(camera, viewport.backingWidth / viewport.backingHeight);
  const forward = (point: XYZ): XY => {
    const v = [0, 1, 2, 3].map(row => matrices.view[row]! * point[0] + matrices.view[row + 4]! * point[1] + matrices.view[row + 8]! * point[2] + matrices.view[row + 12]!);
    const clip = [0, 1, 2, 3].map(row => matrices.projection[row]! * v[0]! + matrices.projection[row + 4]! * v[1]! + matrices.projection[row + 8]! * v[2]! + matrices.projection[row + 12]! * v[3]!);
    return [(1 + clip[0]! / clip[3]!) * viewport.width / 2, (1 - clip[1]! / clip[3]!) * viewport.height / 2];
  };
  const depth = -(matrices.view[2]! * origin[0] + matrices.view[6]! * origin[1] + matrices.view[10]! * origin[2] + matrices.view[14]!);
  return {origin, forward, radius: 160 * depth / (matrices.projection[5]! * viewport.height)};
}
function derive(document: RenderNativeSceneDocument, mode: RenderSceneGizmoMode, key: RenderSceneGizmoKey): RenderNativeScenePose {
  const current = pose(document), {origin, forward, radius} = projection(document);
  const space = mode === 'translate' ? 'world' : 'local';
  const prepared = prepareRenderNativeSceneGizmo(document, BODY, camera, viewport, mode, space);
  check(prepared.handles.some(handle => handle.key === key), 'Requested actual Native handle is unavailable.');
  const axis = key === 'x' ? 0 : key === 'y' ? 1 : 2;
  let from: XY, to: XY;
  if (mode === 'translate') {
    from = forward(origin.map((value, index) => value + (index === axis ? .2 : 0)) as [number, number, number]);
    to = forward(origin.map((value, index) => value + (index === axis ? .3 : 0)) as [number, number, number]);
  } else if (mode === 'scale' && key === 'uniform') {
    const handle = prepared.handles.find(item => item.key === key)!; from = handle.anchor;
    to = [prepared.pivot[0] + (from[0] - prepared.pivot[0]) * 1.1, prepared.pivot[1] + (from[1] - prepared.pivot[1]) * 1.1];
  } else if (mode === 'scale') {
    const direction = rotate(current.rotationXYZW, [0, 1, 2].map(index => index === axis ? 1 : 0) as [number, number, number]);
    from = forward(origin.map((value, index) => value + direction[index]! * radius * .2) as [number, number, number]);
    to = forward(origin.map((value, index) => value + direction[index]! * radius * .3) as [number, number, number]);
  } else {
    const handle = prepared.handles.find(item => item.key === key)!;
    const index = handle.points.findIndex(point => point === handle.anchor); check(index >= 0 && index < 64, 'Actual front anchor phase missing.');
    const a = rotate(current.rotationXYZW, [0, 1, 2].map(i => i === (axis + 1) % 3 ? 1 : 0) as [number, number, number]);
    const b = rotate(current.rotationXYZW, [0, 1, 2].map(i => i === (axis + 2) % 3 ? 1 : 0) as [number, number, number]);
    const at = (theta: number) => forward(origin.map((value, i) => value + radius * (a[i]! * Math.cos(theta) + b[i]! * Math.sin(theta))) as [number, number, number]);
    const theta = index * Math.PI / 32, before = at(theta - 1e-5), after = at(theta + 1e-5), tangent = [after[0] - before[0], after[1] - before[1]], length = Math.hypot(...tangent);
    check(length > 1e-8, 'Independent projected ring tangent is degenerate.');
    from = handle.anchor; to = [from[0] + tangent[0]! / length * 20, from[1] + tangent[1]! / length * 20];
    const next = deriveRenderNativeSceneGizmoPose(document, BODY, camera, viewport, mode, space, key, from, to);
    const half = 20 / 80 / 2, delta = [0, 1, 2].map(i => i === axis ? Math.sin(half) : 0);
    const expected = multiplyQ(current.rotationXYZW, [delta[0]!, delta[1]!, delta[2]!, Math.cos(half)]);
    next.rotationXYZW.forEach((value, i) => close(value, expected[i]!, 1e-7));
    equal(next.translationMM, current.translationMM); equal(next.scale, current.scale); return next;
  }
  const next = deriveRenderNativeSceneGizmoPose(document, BODY, camera, viewport, mode, space, key, from, to);
  if (mode === 'translate') next.translationMM.forEach((value, i) => close(value, current.translationMM[i]! + (i === axis ? .1 / document.display.mmToSceneUnit : 0)));
  else next.scale.forEach((value, i) => close(value, current.scale[i]! * (key === 'uniform' || i === axis ? 1.1 : 1)));
  equal(next.rotationXYZW, current.rotationXYZW); return next;
}
function fixture(referenceSource: string, identity?: {documentId: string; title: string}) {
  check(referenceSource.length === 322 && referenceSource.includes('cloth_reference_981') && referenceSource.includes('reference_panel'), 'Use the genuine unchanged 322-byte reference source; launcher must check its SHA.');
  return createNativeSceneSeed(createNativeSceneBase(referenceSource, clone(material), camera, lighting, identity));
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document);
  const model: {owner: object; shown: RenderNativeSceneDocument; calls: number; fail: Error | null; during: (() => void) | null} =
    {owner: {}, shown: document, calls: 0, fail: null, during: null};
  host.setPresenter(prepared => {
    model.calls++; assertNativeScenePreviewContext(prepared.context, NATIVE_PREVIEW_CONTEXT.mmToSceneUnit, NATIVE_PREVIEW_CONTEXT.background);
    geometrySanity(prepared.authored.document); model.during?.();
    if (model.fail) {const error = model.fail; model.fail = null; throw error;}
    model.shown = prepared.authored.document; model.owner = {};
  }, () => model.owner);
  return {host, model};
}
function commitPose(host: ReturnType<typeof createNativeSceneHost>, mode: RenderSceneGizmoMode, key: RenderSceneGizmoKey): void {
  const before = host.getSnapshot(), raw = host.materialSession.getSnapshot(), next = derive(before.accepted, mode, key), token = host.beginBodyPosePreview(BODY);
  host.previewBodyPose(token, next);
  check(host.getSnapshot().accepted === before.accepted, 'Preview changed accepted authority.');
  const previewRaw = host.materialSession.getSnapshot();
  for (const field of ['accepted', 'sample', 'draftSource', 'draftUniforms', 'diagnostics', 'canUndo', 'canRedo', 'savedRevision'] as const) equal(previewRaw[field], raw[field], 'preview material.' + field);
  check(host.getSnapshot().canUndo === before.canUndo && host.getSnapshot().canRedo === before.canRedo && host.getSnapshot().savedRevision === before.savedRevision, 'Preview changed history/saved flags.');
  host.applyBodyPosePreview(token);
  const after = host.getSnapshot(); check(!after.poseGestureActive && after.posePreview === null && !after.dirty, 'Released pose remained pending.');
  check(after.accepted.revision === before.accepted.revision + 1, 'Pose release must create one revision/history entry.');
  equal(pose(after.accepted), next, 'committed pose'); preserved(after.accepted, before.accepted);
  refuses(() => host.previewBodyPose(token, next));
}
function sourceRegression(): void {
  const source = '@scene retained { version: 1; background: #123; box #block; sphere #orb; }\r\n#block { size: 1 .7 1.4; translate: .1 0 0; rotate-y: 12deg; }\r\n#orb { radius: .5; translate: -1 0 0; }\r\n';
  const original = inspectRenderSceneObjects(source);
  for (const mode of ['translate', 'rotate', 'scale'] as const) {
    const prepared = prepareRenderSceneGizmo(source, 'block', camera, viewport, mode), handle = prepared.handles.find(item => item.key === (mode === 'rotate' ? 'z' : 'x'));
    check(handle, 'Existing Source handle disappeared.');
    const zero = deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, mode, handle.key, handle.anchor, handle.anchor);
    check(editRenderSceneObjectSource(source, 'block', zero) === source, 'Source no-motion bytes changed.');
    const next = deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, mode, handle.key, handle.anchor, [handle.anchor[0] + 2, handle.anchor[1] - 2]);
    const objects = inspectRenderSceneObjects(editRenderSceneObjectSource(source, 'block', next)); equal(objects[1], original[1], 'Source unrelated object');
  }
}
function nativeHitDepth(document: RenderNativeSceneDocument): void {
  const preparation = prepareRenderNativeSceneGizmo(document, BODY, camera, viewport, 'rotate', 'local');
  check(preparation.handles.length === 3, 'The admitted oblique view requires all three actual Native rings.');
  check(hitTestRenderSceneGizmo(preparation, preparation.pivot) === null, 'Shared origin must pass through.');
  check(hitTestRenderSceneGizmo(preparation, [0, 0]) === null, 'Background must pass through.');
  for (const handle of preparation.handles) {
    check(handle.segments?.length === 64 && handle.segments.some(segment => segment.front) && handle.segments.some(segment => !segment.front), 'Native ring front/rear segments are incomplete.');
    const frontPoint = handle.segments.filter(segment => segment.front).flatMap(segment => segment.points)
      .find(point => hitTestRenderSceneGizmo(preparation, point) === handle);
    check(frontPoint, 'Actual Native ring has no directly selectable front point.');
    check(hitTestRenderSceneGizmo({...preparation, handles: [...preparation.handles].reverse()}, frontPoint) === handle, 'Native hit depends on handle order.');
  }
  const current = pose(document), {origin, radius} = projection(document), matrices = prepareCamera(camera, viewport.backingWidth / viewport.backingHeight);
  const depth = (point: XYZ): number => {
    const viewed = [0, 1, 2, 3].map(row => matrices.view[row]! * point[0] + matrices.view[row + 4]! * point[1] + matrices.view[row + 8]! * point[2] + matrices.view[row + 12]!);
    const z = [0, 1, 2, 3].reduce((sum, column) => sum + matrices.projection[column * 4 + 2]! * viewed[column]!, 0);
    const w = [0, 1, 2, 3].reduce((sum, column) => sum + matrices.projection[column * 4 + 3]! * viewed[column]!, 0);
    return z / w;
  };
  // The oracle derives quaternion local planes and public camera depths independently.
  const depths = preparation.handles.map(handle => {
    const axis = ['x', 'y', 'z'].indexOf(handle.key), a = rotate(current.rotationXYZW, [0, 1, 2].map(i => i === (axis + 1) % 3 ? 1 : 0) as [number, number, number]),
      b = rotate(current.rotationXYZW, [0, 1, 2].map(i => i === (axis + 2) % 3 ? 1 : 0) as [number, number, number]);
    return Array.from({length: 65}, (_, index) => depth(origin.map((value, i) => value + radius * (a[i]! * Math.cos(index * Math.PI / 32) + b[i]! * Math.sin(index * Math.PI / 32))) as [number, number, number]));
  });
  const crossing = (a: XY, b: XY, c: XY, d: XY) => {
    const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]], divisor = u[0]! * v[1]! - u[1]! * v[0]!;
    if (Math.abs(divisor) < 1e-9) return null;
    const difference = [c[0] - a[0], c[1] - a[1]], first = (difference[0]! * v[1]! - difference[1]! * v[0]!) / divisor,
      second = (difference[0]! * u[1]! - difference[1]! * u[0]!) / divisor;
    return first > 0 && first < 1 && second > 0 && second < 1 ? {first, second, point: [a[0] + u[0]! * first, a[1] + u[1]! * first] as XY} : null;
  };
  let verified = false;
  for (let first = 0; first < 3 && !verified; first++) for (let second = first + 1; second < 3 && !verified; second++) {
    const one = preparation.handles[first]!, two = preparation.handles[second]!;
    for (let a = 0; a < 64 && !verified; a++) for (let b = 0; b < 64 && !verified; b++) {
      const intersection = crossing(one.points[a]!, one.points[a + 1]!, two.points[b]!, two.points[b + 1]!);
      if (!intersection || Math.hypot(intersection.point[0] - preparation.pivot[0], intersection.point[1] - preparation.pivot[1]) <= 14) continue;
      const left = depths[first]![a]! + (depths[first]![a + 1]! - depths[first]![a]!) * intersection.first,
        right = depths[second]![b]! + (depths[second]![b + 1]! - depths[second]![b]!) * intersection.second;
      if (Math.abs(left - right) <= 1e-7) continue;
      const expected = left < right ? one : two, pair = {...preparation, handles: [one, two]};
      check(hitTestRenderSceneGizmo(pair, intersection.point) === expected, 'Actual Native crossing lost shared projected depth metadata.');
      check(hitTestRenderSceneGizmo({...pair, handles: [two, one]}, intersection.point) === expected, 'Native nearest-depth tie depends on handle order.'); verified = true;
    }
  }
  check(verified, 'No actual Native ring crossing with independently distinct depth was qualified.');
}

export function runNativeSceneGizmoFlow(referenceSource: string): NativeSceneGizmoFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return cpu(reads, () => {
    const original = fixture(referenceSource), {host, model} = harness(original), initialAccepted = host.getSnapshot().accepted;
    host.selectTarget(BODY); const selected = host.getSnapshot(); check(selected.accepted === initialAccepted, 'Selection changed authority.');
    geometrySanity(original);
    for (const [mode, key] of [['translate', 'x'], ['rotate', 'z'], ['scale', 'x'], ['scale', 'uniform']] as const) commitPose(host, mode, key);
    const finalPose = pose(host.getSnapshot().accepted); check(Math.abs(finalPose.rotationXYZW[2]) > .1 && finalPose.scale[0] > finalPose.scale[1], 'Local rotate/nonuniform scale witness missing.');
    host.commitPrepared(host.prepareUndo()!); host.commitPrepared(host.prepareRedo()!);
    equal(pose(host.getSnapshot().accepted), finalPose); preserved(host.getSnapshot().accepted, original);
    checks.push('World Move X/local quaternion Rotate/independent Scale X/uniform Scale: real Native admission, preview holds authority/history/raw; each release ONE history; whole Undo/Redo.');
    const noOpBefore = host.getSnapshot(), noOp = host.beginBodyPosePreview(BODY);
    host.previewBodyPose(noOp, pose(noOpBefore.accepted)); check(host.applyBodyPosePreview(noOp) === null, 'No-motion must not commit.');
    check(host.getSnapshot().accepted === noOpBefore.accepted, 'No-op replaced accepted authority.');
    const returned = host.beginBodyPosePreview(BODY); host.previewBodyPose(returned, derive(noOpBefore.accepted, 'translate', 'x'));
    host.previewBodyPose(returned, pose(noOpBefore.accepted)); check(host.applyBodyPosePreview(returned) === null, 'Return-to-origin must not commit.');
    check(host.getSnapshot().accepted === noOpBefore.accepted, 'Return-to-origin changed authority.');
    const token = host.beginBodyPosePreview(BODY), before = host.getSnapshot().accepted, next = derive(before, 'translate', 'x'), failure = new Error('Declared CPU presentation refusal');
    model.fail = failure; refuses(() => host.previewBodyPose(token, next)); check(host.getSnapshot().accepted === before && host.getSnapshot().posePreview === null, 'First refusal changed authority/last-good pose.');
    host.previewBodyPose(token, next); const good = host.getSnapshot().posePreview;
    model.fail = failure; refuses(() => host.previewBodyPose(token, {...next, translationMM: [next.translationMM[0] + 10, next.translationMM[1], next.translationMM[2]]}));
    check(host.getSnapshot().posePreview === good, 'Retained refusal lost last-good identity.');
    model.fail = failure; refuses(() => host.cancelBodyPosePreview(token));
    check(host.getSnapshot().posePreview === good && host.getSnapshot().accepted === before, 'Failed Cancel abandoned pending preview.');
    refuses(() => host.stageLighting(lighting)); host.cancelBodyPosePreview(token); check(host.getSnapshot().posePreview === null, 'Cancel retained pending preview.'); equal(model.shown, before, 'Cancel actual restored model document');
    const blocked = host.beginBodyPosePreview(BODY); const calls = model.calls;
    for (const operation of [() => host.selectTarget(OTHER), () => host.materialSession.setDraftUniforms({amount: .2}), () => host.stageLighting(lighting), () => host.prepareUndo(), () => host.prepareOpen(serializeRenderNativeSceneDocument(original))]) refuses(operation);
    check(model.calls === calls && host.getSnapshot().accepted === before, 'Blocked command presented or committed.'); host.cancelBodyPosePreview(blocked);
    checks.push('Zero-motion no history; first/retained preview refusal; failed Cancel remains pending/retryable; target/raw/light/File/history blocked during capture.');
    const stale = host.beginBodyPosePreview(BODY), staleCalls = model.calls; model.owner = {};
    refuses(() => host.previewBodyPose(stale, next)); check(model.calls === staleCalls && host.getSnapshot().accepted === before, 'Stale owner presented an old frame.');
    host.materialSession.setDraftUniforms({amount: NaN}); const rawInvalid = host.materialSession.getSnapshot(), rawAccepted = host.getSnapshot().accepted;
    refuses(() => host.beginBodyPosePreview(BODY)); check(host.getSnapshot().accepted === rawAccepted && Number.isNaN(host.materialSession.getSnapshot().draftUniforms.amount), 'Raw invalid draft was consumed by a gesture.');
    equal(host.materialSession.getSnapshot(), rawInvalid); host.discardDraft();
    const other = harness(original); refuses(() => other.host.previewBodyPose(stale, next)); other.host.dispose();
    const fresh = harness(original); fresh.host.selectTarget(BODY); const reentrant = fresh.host.beginBodyPosePreview(BODY), baseline = fresh.host.getSnapshot().accepted;
    fresh.model.during = () => {refuses(() => fresh.host.stageLighting(lighting));}; refuses(() => fresh.host.previewBodyPose(reentrant, derive(baseline, 'translate', 'x')));
    check(fresh.host.getSnapshot().accepted === baseline, 'Caught callback reentry committed CPU authority.'); fresh.model.during = null; fresh.host.dispose();
    checks.push('Foreign/stale presentation-owner token and caught callback reentry refuse; no old-frame restoration or CPU acceptance claim.');
    const q = multiplyQ([0, Math.sin(.2), 0, Math.cos(.2)], [Math.sin(.15), 0, 0, Math.cos(.15)]);
    const nonIdentity = withPose(original, {...pose(original), rotationXYZW: q, scale: [.001, .7, 1.2]});
    const rig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'native_axis_rig', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', camera,
      background: [0, 0, 0], geometries: [], materials: [], nodes: [{id: 'body_axis', type: 'group', parentId: null, translation: [0, 0, 0], rotationXYZW: [...q], scale: [1, 1, 1], visible: true}]});
    for (let axis = 0; axis < 3; axis++) {const expected = rotate(q, [0, 1, 2].map(i => i === axis ? 1 : 0) as [number, number, number]); expected.forEach((value, i) => close(rig.nodes[0]!.worldMatrix[axis * 4 + i]!, value));}
    check(prepareRenderNativeSceneGizmo(nonIdentity, BODY, camera, viewport, 'scale', 'local').handles.some(handle => handle.key === 'x'), 'Native .001 scale was incorrectly narrowed by EngineScene admission.');
    for (const key of ['x', 'y', 'z'] as const) {
      const next = derive(nonIdentity, 'scale', key); equal(next.translationMM, pose(nonIdentity).translationMM);
      equal(next.rotationXYZW, q); geometrySanity(withPose(nonIdentity, next));
    }
    derive(nonIdentity, 'rotate', 'z');
    refuses(() => prepareRenderNativeSceneGizmo(nonIdentity, BODY, camera, viewport, 'scale', 'world'));
    nativeHitDepth(nonIdentity);
    const empty = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: []}}), emptyHost = harness(empty).host;
    emptyHost.selectTarget(BODY); const emptyAccepted = emptyHost.getSnapshot().accepted, emptyToken = emptyHost.beginBodyPosePreview(BODY);
    emptyHost.previewBodyPose(emptyToken, pose(emptyAccepted)); check(emptyHost.applyBodyPosePreview(emptyToken) === null && emptyHost.getSnapshot().accepted === emptyAccepted && emptyHost.getSnapshot().accepted.display.poses.length === 0, 'Zero-motion expanded empty authored poses.');
    commitPose(emptyHost, 'translate', 'x'); check(emptyHost.getSnapshot().accepted.display.poses.length === 2, 'Real empty-pose edit must cover both original bodies.'); emptyHost.dispose();
    const rings = prepareRenderNativeSceneGizmo(original, BODY, camera, viewport, 'rotate', 'local');
    check(rings.handles.every(handle => handle.segments?.some(segment => segment.front)), 'Front ring geometry missing.');
    check(rings.handles.every(handle => Math.hypot(handle.anchor[0] - rings.pivot[0], handle.anchor[1] - rings.pivot[1]) > 12), 'Ring anchor is inside the shared origin exclusion.');
    let getters = 0; const bad = {...viewport}; Object.defineProperty(bad, 'width', {enumerable: true, get() {getters++; return 900;}});
    refuses(() => prepareRenderNativeSceneGizmo(original, BODY, camera, bad, 'translate', 'world')); check(getters === 0, 'Input accessor executed.');
    const unavailable = prepareRenderNativeSceneGizmo(original, BODY, camera, {...viewport, backingWidth: 3000, backingHeight: 1000}, 'rotate', 'local'); check(unavailable.handles.length === 0 && unavailable.unavailable !== null, 'Rotation2048 profile silently widened.');
    sourceRegression(); checks.push('Independent quaternion/public unit-rig axes; Native .001 scale; actual positions/inverse-scale normals; actual public Native hit/front arcs/crossing nearest-depth/order independence; getter0/2048 profile; narrow unchanged Source Move/Rotate/Scale regression.');
    host.stageLighting({ambientStrength: .7, directionalStrength: .3, direction: [-.4, .8, .2]}); host.commitPrepared(host.prepareDraft());
    const first = host.getSnapshot().accepted; preserved(first, original, true); geometrySanity(first);
    const firstFileText = serializeRenderNativeSceneDocument(first); equal(parseRenderNativeSceneDocument(firstFileText), first, 'authored codec roundtrip');
    check(firstFileText.includes('-0'), 'Unselected authored signed zero was lost.'); host.dispose();
    checks.push('Complete light candidate after body manipulation; authored FIRST JSON preserves original source/TEN/material/camera/unselected pose and signed zero. Launcher writes real file and fresh emitted child.');
    return {scope, checks, browserGlobalReads: reads, firstFileText, firstRevision: first.revision};
  });
}

export function runNativeSceneGizmoColdFlow(referenceSource: string, firstFileText: string): NativeSceneGizmoFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return cpu(reads, () => {
    const first = parseRenderNativeSceneDocument(firstFileText), seed = fixture(referenceSource, {documentId: first.documentId, title: first.title});
    preserved(first, seed, true); geometrySanity(first);
    check(serializeRenderNativeSceneDocument(first) === firstFileText, 'FIRST is not actual canonical authoring codec output.');
    const {host} = harness(seed); host.commitPrepared(host.prepareOpen(firstFileText));
    check(host.getSnapshot().savedRevision === first.revision && !host.getSnapshot().canUndo && !host.getSnapshot().canRedo, 'Fresh Open did not reset history/saved baseline.');
    host.selectTarget(BODY); commitPose(host, 'translate', 'x');
    host.stageLighting({ambientStrength: .6, directionalStrength: .4, direction: [.2, .9, -.3]}); host.commitPrepared(host.prepareDraft());
    const second = host.getSnapshot().accepted; preserved(second, first, true); geometrySanity(second);
    check(second.revision === first.revision + 2, 'Fresh reedit must create one pose and one complete light history entry.');
    const secondFileText = serializeRenderNativeSceneDocument(second); equal(parseRenderNativeSceneDocument(secondFileText), second); host.dispose();
    checks.push('Fresh emitted process receives FIRST JSON only: genuine Open/reset, B world Move X one commit, full light one commit, original authorship/pins/unselected pose retained, SECOND authored JSON. No parent runtime objects.');
    return {scope, checks, browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText};
  });
}

export function verifyNativeSceneGizmoFiles(referenceSource: string, firstFileText: string, secondFileText: string): NativeSceneGizmoFlowResult {
  const reads: string[] = [];
  return cpu(reads, () => {
    const first = parseRenderNativeSceneDocument(firstFileText), second = parseRenderNativeSceneDocument(secondFileText), seed = fixture(referenceSource, {documentId: first.documentId, title: first.title});
    preserved(first, seed, true); preserved(second, first, true); geometrySanity(first); geometrySanity(second);
    check(serializeRenderNativeSceneDocument(first) === firstFileText && serializeRenderNativeSceneDocument(second) === secondFileText, 'Supplied files are not canonical actual codec outputs.');
    check(second.revision > first.revision, 'Genuine SECOND revision did not advance.');
    check(JSON.stringify(pose(first)) !== JSON.stringify(pose(seed)) && JSON.stringify(pose(second)) !== JSON.stringify(pose(first)), 'Genuine body manipulations missing.');
    return {scope, checks: ['Supplied genuine GUI FIRST/SECOND only: recompiled original CAD/material/poses/frame, source/TEN/camera/unselected pose unchanged; canonical files, monotonic revision and B reedit. GUI pixels remain separate primary evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision};
  });
}
