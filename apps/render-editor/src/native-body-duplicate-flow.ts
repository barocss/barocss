import {deriveRenderNativeSceneBodyDuplicate, prepareRenderNativeSceneAppearance, validateRenderNativeSceneDocument,
  serializeRenderNativeSceneDocument, parseRenderNativeSceneDocument, deriveRenderCameraInteraction} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneBodyDuplicateOptions} from '@barocss/render-editor';
import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** Private launcher owns five-package graph receipts, first failures, actual files and cold processes. */
export interface NativeBodyDuplicateFlowResult {
  readonly scope: string; readonly checks: readonly string[]; readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string; readonly secondFileText?: string; readonly firstRevision?: number; readonly secondRevision?: number;
  readonly copyIds?: {bodyId: string; assetId: string; materialDocumentId: string};
}
const A = 'body_preview_a', B = 'body_preview_b';
const scope = 'Real public original Native duplicate/CAD/Interop/appearance and private host CPU protocol. Public Viewer camera-override preflight is real; callbacks model presentation only, never Viewer instance/GL/Canvas/pixels. Files contain complete original authored sources.';
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const,
  documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const camera: MeshCamera = {eye: [2, 1.45, 2], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const lighting = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function clone<T>(value: T): T {return structuredClone(value);}
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs.');
  const left = Object.keys(a), right = Object.keys(b); check(left.length === right.length && left.every(key => right.includes(key)), label + ' fields differ.');
  for (const key of left) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function refuses(operation: () => unknown): void {try {operation();} catch {return;} throw new Error('Expected refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('CPU flow read browser global ' + key);}});
    }
    return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function seed(source: string, identity?: {documentId: string; title: string}) {
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes('reference_panel'), 'Supply genuine322B reference; launcher checks original SHA.');
  return createNativeSceneSeed(createNativeSceneBase(source, clone(material), clone(camera), clone(lighting), identity));
}
function copyBody(document: RenderNativeSceneDocument): string {
  const bodies = document.nativeDocument.bodies.filter(body => body.id !== A && body.id !== B); check(bodies.length === 1, 'Expected exactly one genuine copy body.'); return bodies[0]!.id;
}
function originalPreserved(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title'] as const) equal(document[key], original[key]);
  for (const key of ['schema', 'version', 'profile', 'documentId', 'units', 'nativeFrame', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches'] as const) equal(document.nativeDocument[key], original.nativeDocument[key], 'native.' + key);
  for (const asset of original.nativeDocument.assets) equal(document.nativeDocument.assets.find(item => item.id === asset.id), asset, 'original complete asset');
  for (const body of original.nativeDocument.bodies) equal(document.nativeDocument.bodies.find(item => item.id === body.id), body, 'original body');
  equal(document.nativeOptions.native, original.nativeOptions.native); equal(document.nativeOptions.basis, original.nativeOptions.basis);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'lighting', 'basis'] as const) equal(document.display[key], original.display[key], 'display.' + key);
  for (const bodyId of [A, B]) {
    equal(document.display.poses.find(item => item.bodyId === bodyId), original.display.poses.find(item => item.bodyId === bodyId), 'original pose');
    const current = document.surfaceMaterials.find(item => item.target.bodyId === bodyId)!, before = original.surfaceMaterials.find(item => item.target.bodyId === bodyId)!;
    check(current && before, 'Original material missing.'); equal(current.material, before.material, 'original full material');
    equal({...current.target, documentRevision: before.target.documentRevision}, before.target, 'original target except actual CAD revision');
    check(current.target.documentRevision === document.nativeDocument.revision, 'Original material target pins were not regenerated.');
  }
}
function qualified(document: RenderNativeSceneDocument): void {
  const prepared = prepareRenderNativeSceneAppearance(document);
  check(prepared.authored.entries.length === document.nativeOptions.bodyIds!.length && prepared.viewer.prepared.primitives.length === document.display.visibleBodyIds.length, 'Real native inventory differs.');
  for (const entry of prepared.authored.entries) {
    check(entry.kind === 'surface' && entry.binding.modelId === 'cloth_reference_981' && entry.binding.geometryId === 'reference_panel', 'Original model/Surface changed.');
    check(entry.binding.documentRevision === document.nativeDocument.revision, 'Real TEN document revision mismatch.');
    const target = document.surfaceMaterials.find(item => item.target.bodyId === entry.binding.bodyId)!;
    for (const key of ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'] as const) equal(target.target[key], entry.binding[key], 'actual regenerated target');
    const sampled = prepared.authored.materials.find(item => item.target.bodyId === entry.binding.bodyId)!.preparation.sample;
    equal(sampled.linearRGB, [1 - target.material.uniforms.amount!, 0, target.material.uniforms.amount!], 'real material sample');
  }
  equal(parseRenderNativeSceneDocument(serializeRenderNativeSceneDocument(document)), document, 'whole codec and signed zero');
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document), model = {camera: clone(document.display.camera), owner: {} as object, calls: 0, shown: host.getSnapshot().accepted, fail: false};
  host.setPresenter((prepared, override) => {
    model.calls++; const request = prepareNativeViewportAppearance(prepared, override), actual = prepareViewerNativeSceneAppearance(request, prepared.context);
    if (model.fail) {model.fail = false; throw new Error('Declared CPU presenter refusal');}
    model.camera = clone(actual.display.camera); model.owner = {}; model.shown = prepared.authored.document;
  }, () => model.owner, () => clone(model.camera));
  host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document)));
  return {host, model, close: () => host.dispose()};
}
function editCopy(host: ReturnType<typeof createNativeSceneHost>, bodyId: string, x: number, amount: number): void {
  host.selectTarget(bodyId); const before = host.getSnapshot().accepted, pose = before.display.poses.find(item => item.bodyId === bodyId)!;
  host.stageBodyPose(bodyId, {translationMM: [x, pose.translationMM[1], pose.translationMM[2]], scale: [x === 1800 ? 1.2 : 1.3, pose.scale[1], pose.scale[2]]});
  host.materialSession.setDraftUniforms({amount}); host.commitPrepared(host.prepareDraft()); check(host.getSnapshot().accepted.revision === before.revision + 1, 'Copy-only transform/material must accept once.');
}

export function runNativeBodyDuplicateFlow(referenceSource: string): NativeBodyDuplicateFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return guarded(reads, () => {
    const original = seed(referenceSource), bytes = serializeRenderNativeSceneDocument(original), result = deriveRenderNativeSceneBodyDuplicate(original, B);
    check(Object.isFrozen(result) && Object.isFrozen(result.document), 'Duplicate must return owned frozen data.');
    check(result.document.revision === original.revision && result.document.nativeDocument.revision === original.nativeDocument.revision + 1, 'Duplicate revision policy changed.');
    originalPreserved(result.document, original); qualified(result.document);
    const copyAsset = result.document.nativeDocument.assets.find(item => item.id === result.assetId)!;
    check(copyAsset.revision === 0 && copyAsset.source === original.nativeDocument.assets.find(item => item.id === 'preview_b')!.source && copyAsset.source.length === 322, 'Complete original source copy/revision0 missing.');
    const newBody = result.document.nativeDocument.bodies.find(item => item.id === result.bodyId)!; check(newBody.assetId === result.assetId && newBody.geometryId === 'reference_panel', 'Copy body is not original geometry/new asset.');
    const copiedMaterial = result.document.surfaceMaterials.find(item => item.target.bodyId === result.bodyId)!.material, oldMaterial = original.surfaceMaterials.find(item => item.target.bodyId === B)!.material;
    equal({...copiedMaterial, documentId: oldMaterial.documentId, revision: oldMaterial.revision}, oldMaterial, 'independent material document'); check(copiedMaterial.documentId === result.materialDocumentId && copiedMaterial.revision === 0, 'Copy material identity/revision0 missing.');
    equal({...result.document.display.poses.find(item => item.bodyId === result.bodyId)!, bodyId: B}, original.display.poses.find(item => item.bodyId === B), 'initial overlapping exact pose');
    const ids = [result.assetId, result.bodyId, result.materialDocumentId]; check(ids.every(id => id.length <= 48) && new Set(ids).size === 3, 'Generated IDs invalid/colliding.');
    const reserved = deriveRenderNativeSceneBodyDuplicate(original, B, {reservedIds: [...ids, ids[0]!]}); check([reserved.assetId, reserved.bodyId, reserved.materialDocumentId].every(id => !ids.includes(id)), 'Reserved global IDs reused.');
    check(serializeRenderNativeSceneDocument(original) === bytes, 'Derivation mutated input original bytes.');
    checks.push('Actual public full-asset source copy, newasset0/nativeCAD+1/outer unchanged, real TEN target regeneration, old A/B exact except actual targetdocrevision, independent material0 and exact overlapping pose/q/-0; deterministic reserved collision avoidance.');

    let getters = 0; const unsafe = {}; Object.defineProperty(unsafe, 'name', {enumerable: true, get() {getters++; throw new Error('Unsafe options');}});
    refuses(() => deriveRenderNativeSceneBodyDuplicate({...original, format: 'wrong'} as unknown as RenderNativeSceneDocument, B, unsafe));
    refuses(() => deriveRenderNativeSceneBodyDuplicate(original, B, unsafe)); check(getters === 0, 'Option getter invoked.');
    for (const options of [{name: 'x'.repeat(129)}, {reservedIds: ['invalid space']}, {reservedIds: Array(1)}, {reservedIds: Array.from({length: 2049}, () => 'held_id')}, {extra: true}, {[Symbol('x')]: true}]) refuses(() => deriveRenderNativeSceneBodyDuplicate(original, B, options as unknown as RenderNativeSceneBodyDuplicateOptions));
    refuses(() => deriveRenderNativeSceneBodyDuplicate(original, 'foreign_body'));
    const hidden = validateRenderNativeSceneDocument({...original, display: {...original.display, visibleBodyIds: [A]}, surfaceMaterials: original.surfaceMaterials.filter(item => item.target.bodyId === A)});
    refuses(() => deriveRenderNativeSceneBodyDuplicate(hidden, B));
    const overflow = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument, revision: 2147483647}, surfaceMaterials: original.surfaceMaterials.map(item => ({...item, target: {...item.target, documentRevision: 2147483647}}))});
    refuses(() => deriveRenderNativeSceneBodyDuplicate(overflow, B));
    const four = deriveRenderNativeSceneBodyDuplicate(result.document, B).document; check(four.nativeDocument.assets.length === 4 && four.display.visibleBodyIds.length === 4, 'Actual4cap fixture missing.'); refuses(() => deriveRenderNativeSceneBodyDuplicate(four, B));
    const oversized = {...original, nativeDocument: {...original.nativeDocument, assets: original.nativeDocument.assets.map(asset => asset.id === 'preview_b' ? {...asset, source: asset.source + '\n/*' + 'x'.repeat(262144) + '*/'} : asset)}};
    refuses(() => deriveRenderNativeSceneBodyDuplicate(oversized, B));
    refuses(() => deriveRenderNativeSceneBodyDuplicate({...original, nativeOptions: {...original.nativeOptions, native: {...original.nativeOptions.native, countU: 18}}}, B));
    const curveSource = '@model curve_refusal {version:0;length-unit:mm;@curve #skip_path_native {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[-2,5,0],[6,5,0]];weights:[1,1];}}';
    const curve = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument,
      assets: [...original.nativeDocument.assets, {id: 'curve_asset', revision: 0, role: 'authored-native-source', sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source: curveSource}],
      bodies: [...original.nativeDocument.bodies, {id: 'curve_body', name: 'Curve refusal', kind: 'direct-geometry-object', assetId: 'curve_asset', geometryId: 'skip_path_native'}]},
      nativeOptions: {...original.nativeOptions, bodyIds: [...original.nativeOptions.bodyIds!, 'curve_body'], native: {...original.nativeOptions.native, curveDisplay: {chordToleranceMM: .1, maxSegments: 8, maxDepth: 4}}},
      display: {...original.display, visibleBodyIds: [...original.display.visibleBodyIds, 'curve_body'], poses: [...original.display.poses, {bodyId: 'curve_body', translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]}]}});
    refuses(() => deriveRenderNativeSceneBodyDuplicate(curve, 'curve_body'));
    const q = [0, Math.sin(.2), 0, Math.cos(.2)] as const;
    const posed = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: original.display.poses.map(item => item.bodyId === B ? {...item, rotationXYZW: q, scale: [1.2, .8, 1.1]} : item)}});
    const posedCopy = deriveRenderNativeSceneBodyDuplicate(posed, B); equal({...posedCopy.document.display.poses.find(item => item.bodyId === posedCopy.bodyId)!, bodyId: B}, posed.display.poses.find(item => item.bodyId === B));
    const empty = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: []}}); check(deriveRenderNativeSceneBodyDuplicate(empty, B).document.display.poses.length === 0, 'Duplicate expanded original empty identity pose semantics.');
    checks.push('Bounded own options/getter0/invalid-original-before-options, reserved/name/count/data refusals; unknown/hidden target, CADrevisionoverflow, actual4inventory cap and originalsource budget.');

    const h = harness(original); h.host.selectTarget(B); const local = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 28, deltaY: -15, width: 900, height: 600});
    h.model.camera = clone(local); h.host.observeView(local); const before = h.host.getSnapshot().accepted;
    h.host.duplicateSelectedBody(); const copied = h.host.getSnapshot().accepted, copyId = copyBody(copied);
    check(copied.revision === before.revision + 1 && h.host.getSnapshot().selectedBodyId === copyId && copied.nativeDocument.assets.length === 3, 'Host Duplicate must accept once/select actual copy.'); equal(h.model.camera, local); originalPreserved(copied, original);
    const idsFirst = {bodyId: copyId, assetId: copied.nativeDocument.bodies.find(body => body.id === copyId)!.assetId, materialDocumentId: copied.surfaceMaterials.find(item => item.target.bodyId === copyId)!.material.documentId};
    editCopy(h.host, copyId, 1800, .2); originalPreserved(h.host.getSnapshot().accepted, original); equal(h.model.camera, local);
    const finalPose = clone(h.host.getSnapshot().accepted.display.poses), finalMaterials = clone(h.host.getSnapshot().accepted.surfaceMaterials);
    h.host.commitPrepared(h.host.prepareUndo()!); h.host.commitPrepared(h.host.prepareRedo()!); equal(h.host.getSnapshot().accepted.display.poses, finalPose); equal(h.host.getSnapshot().accepted.surfaceMaterials, finalMaterials); equal(h.model.camera, local);
    const first = h.host.getSnapshot().accepted, firstFileText = serializeRenderNativeSceneDocument(first); qualified(first); h.close();
    checks.push('Private host ONE duplicate Apply/active3inventory; actual display camera reader/override preserved; copy-only numeric/material ONE Apply independent of A/B; whole Undo/Redo; FIRST complete codec file.');

    const retained = harness(original); retained.host.selectTarget(B); retained.host.duplicateSelectedBody(); const firstReserved = copyBody(retained.host.getSnapshot().accepted);
    retained.host.commitPrepared(retained.host.prepareUndo()!); retained.host.selectTarget(B); retained.host.duplicateSelectedBody(); check(copyBody(retained.host.getSnapshot().accepted) !== firstReserved, 'Undo released retained copy ID.'); retained.close();
    const failure = harness(original); failure.host.selectTarget(B); const failedAccepted = failure.host.getSnapshot().accepted, failureCalls = failure.model.calls;
    failure.model.fail = true; refuses(() => failure.host.duplicateSelectedBody()); check(failure.host.getSnapshot().accepted === failedAccepted && failure.host.getSnapshot().nativeDirty && failure.model.calls === failureCalls + 1, 'Refused Duplicate did not retain corrective structural draft.'); equal(failure.model.shown, failedAccepted);
    const stale = failure.host.prepareDraft(); failure.host.discardDraft(); const calls = failure.model.calls; refuses(() => failure.host.commitPrepared(stale)); check(failure.model.calls === calls, 'Stale duplicate candidate presented.');
    failure.host.materialSession.setDraftUniforms({amount: NaN}); const raw = failure.host.materialSession.getSnapshot(); refuses(() => failure.host.duplicateSelectedBody()); check(failure.host.materialSession.getSnapshot() === raw && Number.isNaN(raw.draftUniforms.amount), 'Duplicate consumed invalid raw.'); failure.close();
    checks.push('Retained generated IDs survive Undo/branch; failed presentation preserves accepted/frame with corrective structural draft; stale candidate callback0 and raw NaN refusal. No GPU callback claims.');
    return {scope, checks, browserGlobalReads: reads, firstFileText, firstRevision: first.revision, copyIds: idsFirst};
  });
}

export function runNativeBodyDuplicateColdFlow(referenceSource: string, firstText: string): NativeBodyDuplicateFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); originalPreserved(first, original); qualified(first);
    check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST must be real canonical codec bytes.'); const h = harness(original); h.host.commitPrepared(h.host.prepareOpen(firstText));
    check(!h.host.getSnapshot().canUndo && h.host.getSnapshot().savedRevision === first.revision, 'Fresh Open did not reset history/saved baseline.');
    const copyId = copyBody(first), view = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 18, deltaY: -12, width: 900, height: 600}); h.model.camera = clone(view); h.host.observeView(view);
    editCopy(h.host, copyId, 1950, .4); const second = h.host.getSnapshot().accepted; check(second.revision === first.revision + 1, 'Fresh copy-only reedit must accept once.');
    equal(second.nativeDocument, first.nativeDocument); originalPreserved(second, original); qualified(second); equal(h.model.camera, view);
    const secondFileText = serializeRenderNativeSceneDocument(second); h.close();
    return {scope, checks: ['Fresh emitted process receives FIRST JSON only; original complete asset sources/TEN reconstructed; actual Open/history reset; copy-only numeric/material ONE reedit, local view retained, SECOND canonical file.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText};
  });
}

export function verifyNativeBodyDuplicateFiles(referenceSource: string, firstText: string, secondText: string): NativeBodyDuplicateFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = seed(referenceSource, {documentId: first.documentId, title: first.title});
    originalPreserved(first, original); originalPreserved(second, original); qualified(first); qualified(second); equal(second.nativeDocument, first.nativeDocument);
    check(first.nativeDocument.revision === original.nativeDocument.revision + 1 && first.nativeDocument.assets.length === 3 && first.surfaceMaterials.length === 3, 'Genuine one-copy inventory/revision missing.');
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText && second.revision > first.revision, 'Genuine canonical/monotonic files required.');
    const copyId = copyBody(first); check(copyBody(second) === copyId, 'Reedit replaced copy identity.'); const body = first.nativeDocument.bodies.find(item => item.id === copyId)!;
    const asset = first.nativeDocument.assets.find(item => item.id === body.assetId)!; check(asset.revision === 0 && asset.source === referenceSource && body.geometryId === 'reference_panel', 'Genuine copy source/asset0/native geometry changed.');
    const copyFirst = first.surfaceMaterials.find(item => item.target.bodyId === copyId)!, copySecond = second.surfaceMaterials.find(item => item.target.bodyId === copyId)!;
    check(copyFirst.material.uniforms.amount !== original.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount && copySecond.material.uniforms.amount !== copyFirst.material.uniforms.amount && copySecond.material.revision > copyFirst.material.revision, 'Independent copy material edits missing.');
    equal(copySecond.material.shaderSource, copyFirst.material.shaderSource); equal(copyFirst.material.shaderSource, original.surfaceMaterials.find(item => item.target.bodyId === B)!.material.shaderSource);
    check(JSON.stringify(first.display.poses.find(item => item.bodyId === copyId)) !== JSON.stringify(second.display.poses.find(item => item.bodyId === copyId)), 'Copy-only transform reedit missing.');
    return {scope, checks: ['Supplied genuine files only: whole original322B copy/newasset0/nativeCAD+1, real TEN pins, A/B exact source/material/pose/camera/light unchanged; copy identity/source stable and independent transform/material monotonic reedit. Graphics/clicks separate GUI evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, copyIds: {bodyId: copyId, assetId: asset.id, materialDocumentId: copyFirst.material.documentId}};
  });
}
