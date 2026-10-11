import {deriveRenderNativeSceneBodyRemoval, deriveRenderNativeSceneBodyDuplicate, prepareRenderNativeSceneAppearance,
  validateRenderNativeSceneDocument, serializeRenderNativeSceneDocument, parseRenderNativeSceneDocument, deriveRenderCameraInteraction} from '@barocss/render-editor';
import type {RenderNativeSceneDocument} from '@barocss/render-editor';
import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** Private launcher owns five-package graphs, first failures, real filesystem writes and cold processes. */
export interface NativeBodyRemoveFlowResult {
  readonly scope: string; readonly checks: readonly string[]; readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string; readonly secondFileText?: string; readonly firstRevision?: number; readonly secondRevision?: number;
}
const A = 'body_preview_a', B = 'body_preview_b';
const scope = 'Actual public original Native removal/CAD/Interop/appearance and private host CPU protocol; real public Viewer camera preflight with model callbacks only, never Viewer instance/GL/browser pixel proof. Cold input is original authored JSON only.';
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const, documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const camera: MeshCamera = {eye: [2, 1.45, 2], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100}, lighting = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function clone<T>(value: T): T {return structuredClone(value);}
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return; check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs.');
  const left = Object.keys(a), right = Object.keys(b); check(left.length === right.length && left.every(key => right.includes(key)), label + ' fields differ.');
  for (const key of left) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function refuses(operation: () => unknown): void {try {operation();} catch {return;} throw new Error('Expected refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('CPU flow read browser global ' + key);}});
  } return operation();} finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function seed(source: string, identity?: {documentId: string; title: string}) {
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes('reference_panel'), 'Use genuine322B source; launcher checks original SHA.');
  return createNativeSceneSeed(createNativeSceneBase(source, clone(material), clone(camera), clone(lighting), identity));
}
function qualified(document: RenderNativeSceneDocument): void {
  const prepared = prepareRenderNativeSceneAppearance(document); check(prepared.authored.entries.length === document.nativeOptions.bodyIds!.length, 'Actual selected inventory differs.');
  for (const entry of prepared.authored.entries) {
    const target = document.surfaceMaterials.find(item => item.target.bodyId === entry.binding.bodyId); if (!target) continue;
    for (const key of ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'] as const) equal(target.target[key], entry.binding[key], 'real surviving target/TEN');
  }
  equal(parseRenderNativeSceneDocument(serializeRenderNativeSceneDocument(document)), document, 'whole codec/signed zero');
}
function originals(document: RenderNativeSceneDocument, baseline: RenderNativeSceneDocument, allowBEdit = false): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title'] as const) equal(document[key], baseline[key]);
  for (const key of ['schema', 'version', 'profile', 'documentId', 'units', 'nativeFrame', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches'] as const) equal(document.nativeDocument[key], baseline.nativeDocument[key]);
  equal(document.nativeDocument.assets, baseline.nativeDocument.assets); equal(document.nativeDocument.bodies, baseline.nativeDocument.bodies); equal(document.nativeOptions, baseline.nativeOptions);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'lighting', 'visibleBodyIds', 'basis'] as const) equal(document.display[key], baseline.display[key]);
  for (const bodyId of [A, B]) {
    const currentPose = document.display.poses.find(item => item.bodyId === bodyId)!, priorPose = baseline.display.poses.find(item => item.bodyId === bodyId)!;
    if (bodyId === A || !allowBEdit) equal(currentPose, priorPose, 'surviving pose'); else equal(currentPose.rotationXYZW, priorPose.rotationXYZW, 'original B quaternion');
    const current = document.surfaceMaterials.find(item => item.target.bodyId === bodyId)!, before = baseline.surfaceMaterials.find(item => item.target.bodyId === bodyId)!;
    equal({...current.target, documentRevision: before.target.documentRevision}, before.target); check(current.target.documentRevision === document.nativeDocument.revision, 'Surviving material pins stale.');
    if (bodyId === A || !allowBEdit) equal(current.material, before.material); else for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'shaderSource'] as const) equal(current.material[key], before.material[key]);
  }
  qualified(document);
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document), model = {camera: clone(document.display.camera), owner: {} as object, shown: host.getSnapshot().accepted, calls: 0, fail: false};
  host.setPresenter((prepared, override) => {model.calls++; const actual = prepareViewerNativeSceneAppearance(prepareNativeViewportAppearance(prepared, override), prepared.context);
    if (model.fail) {model.fail = false; throw new Error('Declared CPU presentation refusal');} model.camera = clone(actual.display.camera); model.owner = {}; model.shown = prepared.authored.document;
  }, () => model.owner, () => clone(model.camera)); host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document)));
  return {host, model, close: () => host.dispose()};
}

export function runNativeBodyRemoveFlow(referenceSource: string): NativeBodyRemoveFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return guarded(reads, () => {
    const original = seed(referenceSource), duplicated = deriveRenderNativeSceneBodyDuplicate(original, B), removed = deriveRenderNativeSceneBodyRemoval(duplicated.document, duplicated.bodyId);
    check(removed.revision === duplicated.document.revision && removed.nativeDocument.revision === 3 && Object.isFrozen(removed), 'Removal outer/native revision/frozen policy changed.'); originals(removed, original);
    check(!removed.nativeDocument.assets.some(asset => asset.id === duplicated.assetId) && !removed.surfaceMaterials.some(item => item.material.documentId === duplicated.materialDocumentId), 'Unique copied asset/material not removed.');
    const last = deriveRenderNativeSceneBodyRemoval(original, B); refuses(() => deriveRenderNativeSceneBodyRemoval(last, A)); refuses(() => deriveRenderNativeSceneBodyRemoval(original, 'foreign_body'));
    const hidden = validateRenderNativeSceneDocument({...original, display: {...original.display, visibleBodyIds: [A]}, surfaceMaterials: original.surfaceMaterials.filter(item => item.target.bodyId === A)}); refuses(() => deriveRenderNativeSceneBodyRemoval(hidden, B));
    const overflow = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument, revision: 2147483647}, surfaceMaterials: original.surfaceMaterials.map(item => ({...item, target: {...item.target, documentRevision: 2147483647}}))}); refuses(() => deriveRenderNativeSceneBodyRemoval(overflow, B));
    let getters = 0; const accessor = {...original}; Object.defineProperty(accessor, 'nativeDocument', {enumerable: true, get() {getters++; throw new Error('Unsafe document');}}); refuses(() => deriveRenderNativeSceneBodyRemoval(accessor, B)); check(getters === 0, 'Input getter invoked.');
    refuses(() => deriveRenderNativeSceneBodyRemoval({...original, nativeOptions: {...original.nativeOptions, native: {...original.nativeOptions.native, countU: 18}}}, B));
    refuses(() => deriveRenderNativeSceneBodyRemoval({...original, nativeDocument: {...original.nativeDocument, assets: original.nativeDocument.assets.map(asset => asset.id === 'preview_b' ? {...asset, source: asset.source + '\n/*' + 'x'.repeat(262144) + '*/'} : asset)}}, B));
    checks.push('Actual2seed→whole-source Duplicate3→Remove copy2; actual NativeCADrev3 and regenerated TEN, original A/B complete source/material/q/pose/camera/light unchanged; unique asset pruning, last/hidden/unknown/overflow/getter0 and actual Interop17/CAD262144 refusals.');

    const end = referenceSource.lastIndexOf('}'), start = referenceSource.indexOf('@surface'); check(end > start && start >= 0, 'Original Surface declaration not found.');
    const sharedSource = referenceSource.slice(0, end) + referenceSource.slice(start, end).replace('#reference_panel', '#retained_panel') + '\n' + referenceSource.slice(end);
    const shared = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument,
      assets: original.nativeDocument.assets.map(asset => asset.id === 'preview_b' ? {...asset, source: sharedSource} : asset),
      bodies: [...original.nativeDocument.bodies, {id: 'retained_body', name: 'Unselected genuine Surface', kind: 'direct-geometry-object', assetId: 'preview_b', geometryId: 'retained_panel'}]}});
    const sharedRemoved = deriveRenderNativeSceneBodyRemoval(shared, B); equal(sharedRemoved.nativeDocument.assets.find(asset => asset.id === 'preview_b'), shared.nativeDocument.assets.find(asset => asset.id === 'preview_b'), 'full source asset retained by unselected sibling'); check(sharedRemoved.nativeDocument.bodies.some(body => body.id === 'retained_body'), 'Surviving unselected body removed.'); qualified(sharedRemoved);
    const curveSource = '@model curve_refusal {version:0;length-unit:mm;@curve #skip_path_native {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[-2,5,0],[6,5,0]];weights:[1,1];}}';
    const curve = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument, assets: [...original.nativeDocument.assets, {id: 'curve_asset', revision: 0, role: 'authored-native-source', sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source: curveSource}], bodies: [...original.nativeDocument.bodies, {id: 'curve_body', name: 'Curve refusal', kind: 'direct-geometry-object', assetId: 'curve_asset', geometryId: 'skip_path_native'}]},
      nativeOptions: {...original.nativeOptions, bodyIds: [...original.nativeOptions.bodyIds!, 'curve_body'], native: {...original.nativeOptions.native, curveDisplay: {chordToleranceMM: .1, maxSegments: 8, maxDepth: 4}}}, display: {...original.display, visibleBodyIds: [...original.display.visibleBodyIds, 'curve_body'], poses: [...original.display.poses, {bodyId: 'curve_body', translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]}]}}); refuses(() => deriveRenderNativeSceneBodyRemoval(curve, 'curve_body'));
    const empty = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: []}}); check(deriveRenderNativeSceneBodyRemoval(empty, B).display.poses.length === 0, 'Removal expanded empty identity pose semantics.');
    checks.push('Sharedasset scan includes genuine second Surface body hidden/unselected from actual display; whole original source/revision retained, no fake ref; actual Curve target refused; empty poses[] preserved.');

    const h = harness(duplicated.document); h.host.selectTarget(duplicated.bodyId); const local = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 24, deltaY: -14, width: 900, height: 600}); h.model.camera = clone(local); h.host.observeView(local);
    const before = h.host.getSnapshot().accepted; h.host.removeSelectedBody(); check(h.host.getSnapshot().accepted.revision === before.revision + 1 && h.host.getSnapshot().accepted.nativeDocument.assets.length === 2, 'Host Remove must accept once.'); check(h.host.getSnapshot().targets.some(target => target.bodyId === h.host.getSnapshot().selectedBodyId), 'Selected fallback is not genuine surviving material.'); equal(h.model.camera, local); originals(h.host.getSnapshot().accepted, original);
    h.host.commitPrepared(h.host.prepareUndo()!); equal(h.host.getSnapshot().accepted.nativeDocument, duplicated.document.nativeDocument); check(h.host.getSnapshot().accepted.nativeDocument.assets.find(asset => asset.id === duplicated.assetId)!.revision === 0, 'Undo did not restore actual original copyasset0.');
    h.host.commitPrepared(h.host.prepareRedo()!); originals(h.host.getSnapshot().accepted, original); equal(h.model.camera, local);
    const first = h.host.getSnapshot().accepted, firstFileText = serializeRenderNativeSceneDocument(first); h.host.selectTarget(B); h.host.duplicateSelectedBody(); check(!h.host.getSnapshot().accepted.nativeDocument.bodies.some(body => body.id === duplicated.bodyId), 'Removal released retained body identity for reuse.'); h.close();
    const failed = harness(duplicated.document); failed.host.selectTarget(duplicated.bodyId); const accepted = failed.host.getSnapshot().accepted, calls = failed.model.calls;
    failed.model.fail = true; refuses(() => failed.host.removeSelectedBody()); check(failed.host.getSnapshot().accepted === accepted && failed.host.getSnapshot().selectedBodyId === duplicated.bodyId && failed.host.getSnapshot().nativeDirty && failed.model.calls === calls + 1, 'Refused Remove lost accepted/active/corrective draft.'); equal(failed.model.shown, accepted);
    const stale = failed.host.prepareDraft(); failed.host.discardDraft(); const staleCalls = failed.model.calls; refuses(() => failed.host.commitPrepared(stale)); check(failed.model.calls === staleCalls && failed.host.getSnapshot().selectedBodyId === duplicated.bodyId, 'Stale/discard changed active body or presented.');
    const poseToken = failed.host.beginBodyPosePreview(duplicated.bodyId); const poseCalls = failed.model.calls; refuses(() => failed.host.removeSelectedBody()); check(failed.model.calls === poseCalls, 'Pose-captured removal presented.'); failed.host.cancelBodyPosePreview(poseToken);
    failed.host.materialSession.setDraftUniforms({amount: NaN}); const raw = failed.host.materialSession.getSnapshot(); refuses(() => failed.host.removeSelectedBody()); check(failed.host.materialSession.getSnapshot() === raw, 'Remove consumed invalid raw.'); failed.host.discardDraft(); failed.model.owner = {}; const ownerCalls = failed.model.calls; refuses(() => failed.host.removeSelectedBody()); check(failed.model.calls === ownerCalls, 'Foreign display owner removal presented.'); failed.close();
    checks.push('ONE actual host removal/fallback/localview; inventory UndoRedo restores/removes real asset0 and full sources; removed IDs stay reserved; failed presentation retains corrective draft/old active/frame; Discard/stale/raw/owner refusal.');
    return {scope, checks, browserGlobalReads: reads, firstFileText, firstRevision: first.revision};
  });
}

export function runNativeBodyRemoveColdFlow(referenceSource: string, firstText: string): NativeBodyRemoveFlowResult {
  const reads: string[] = []; return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); originals(first, original); check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST not actual canonical codec bytes.');
    const h = harness(original); h.host.commitPrepared(h.host.prepareOpen(firstText)); check(!h.host.getSnapshot().canUndo && h.host.getSnapshot().savedRevision === first.revision, 'Fresh Open history/saved reset failed.'); h.host.selectTarget(B);
    const local = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 18, deltaY: -12, width: 900, height: 600}); h.model.camera = clone(local); h.host.observeView(local); const pose = first.display.poses.find(item => item.bodyId === B)!;
    h.host.stageBodyPose(B, {translationMM: [1050, pose.translationMM[1], pose.translationMM[2]], scale: [1.1, pose.scale[1], pose.scale[2]]}); h.host.materialSession.setDraftUniforms({amount: .6}); h.host.commitPrepared(h.host.prepareDraft());
    const second = h.host.getSnapshot().accepted; check(second.revision === first.revision + 1, 'Fresh B pose/material reedit must accept once.'); equal(second.nativeDocument, first.nativeDocument); originals(second, original, true); equal(h.model.camera, local); const secondFileText = serializeRenderNativeSceneDocument(second); h.close();
    return {scope, checks: ['Fresh emitted FILE-only Open/reconstruct/reset; original2inventory/nativeCADrev3, B1050/ScaleX1.1/amount.6 ONE combined Apply, original A/source/q/camera/light retained, SECOND codec JSON.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText};
  });
}

export function verifyNativeBodyRemoveFiles(referenceSource: string, firstText: string, secondText: string): NativeBodyRemoveFlowResult {
  const reads: string[] = []; return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); originals(first, original); originals(second, original, true);
    check(first.nativeDocument.revision === 3 && first.nativeDocument.assets.length === 2 && first.surfaceMaterials.length === 2 && second.revision > first.revision, 'Genuine original2inventory/removal revision/monotonicity mismatch.'); equal(second.nativeDocument, first.nativeDocument);
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText, 'Genuine complete codec bytes changed.');
    check(second.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount !== first.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount && JSON.stringify(second.display.poses.find(item => item.bodyId === B)) !== JSON.stringify(first.display.poses.find(item => item.bodyId === B)), 'Genuine surviving B reedit missing.');
    return {scope, checks: ['Supplied genuine GUI files only: copy removed, original2completeassets322B and actual nativeCADrev3/TEN, original A/B before reedit; SECOND only surviving B pose/material change, global camera/light/source/q/A exact; real public reconstruction, no new graphics claim.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision};
  });
}
