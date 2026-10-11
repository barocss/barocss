import {parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, prepareRenderNativeSceneAppearance} from '@barocss/render-editor';
import type {RenderNativeSceneDocument} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

type Mutable<T> = T extends object ? {-readonly [K in keyof T]: Mutable<T[K]>} : T;
const scope = 'Actual SDK/CAD/Appearance and Native host transactions with a declared atomic CPU presenter model. This cloud fixture is not genuine parent SECOND47; no browser, pixels, lexical UI, physical Save/Open or original distributions acceptance.';
function check(value: unknown, message: string): asserts value {if (!value) throw Error(message);}
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs');
  const left = Object.keys(a), right = Object.keys(b);
  check(left.length === right.length && left.every(key => right.includes(key)), label + ' fields differ');
  for (const key of left) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function refuses(operation: () => unknown): void {try {operation();} catch {return;} throw Error('Expected material preview refusal');}
function model(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document);
  let shown = document, view: MeshCamera = structuredClone(document.display.camera), owner: object = {}, calls = 0;
  let fault: ((document: RenderNativeSceneDocument) => boolean) | null = null;
  let after: (() => unknown) | null = null, readFailure = false, readerReentry = false;
  host.setPresenter((prepared, override) => {
    const request = prepareNativeViewportAppearance(prepared, override); calls++;
    if (fault?.(prepared.authored.document)) throw Error('Declared atomic presenter refusal');
    shown = prepared.authored.document; view = structuredClone(request.display.camera); owner = {};
    const callback = after; after = null; return callback?.();
  }, () => {if (readFailure) throw Error('Declared owner read failure'); if (readerReentry) refuses(() => host.discardDraft()); return owner;}, () => view);
  host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document)));
  view = structuredClone(view); view.eye[0] += .5; host.observeView(view);
  const amount = (value: number) => host.materialSession.setDraftUniforms({...host.materialSession.getSnapshot().draftUniforms, amount: value});
  return {host, amount, get shown() {return shown;}, get camera() {return view;}, get calls() {return calls;},
    fault(value: typeof fault) {fault = value;}, after(value: () => unknown) {after = value;},
    changeOwner() {owner = {};}, changeCamera() {view = structuredClone(view); view.eye[0] += .1;},
    failReader() {readFailure = true;}, reenterReader() {readerReentry = true;}};
}
function authority(host: ReturnType<typeof createNativeSceneHost>) {
  const state = host.getSnapshot(), raw = host.materialSession.getSnapshot();
  return {accepted: state.accepted, preparation: state.preparation, draftDocument: state.draftDocument,
    nativeDirty: state.nativeDirty, materialDirty: state.materialDirty, canUndo: state.canUndo, canRedo: state.canRedo,
    savedRevision: state.savedRevision, selectedBodyId: state.selectedBodyId, viewCamera: state.viewCamera,
    bodyPoseInputResetEpoch: state.bodyPoseInputResetEpoch, surfacePoleInputResetEpoch: state.surfacePoleInputResetEpoch,
    raw: {accepted: raw.accepted, sample: raw.sample, draftSource: raw.draftSource, draftUniforms: raw.draftUniforms,
      diagnostics: raw.diagnostics, dirty: raw.dirty, canUndo: raw.canUndo, canRedo: raw.canRedo, savedRevision: raw.savedRevision}};
}

/** Accepts tracked public fixture bytes, whose provenance and hash must be recorded by the launcher. */
export function runNativeSceneMaterialPreviewFlow(text: string) {
  const browserGlobalReads: string[] = [], descriptors = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {browserGlobalReads.push(key); throw Error('CPU flow read ' + key);}});
    }
    const original = parseRenderNativeSceneDocument(text), live = model(original), initial = live.host.getSnapshot();
    const bodyId = initial.selectedBodyId, acceptedMaterial = initial.accepted.surfaceMaterials.find(item => item.target.bodyId === bodyId)!.material;
    check(initial.targets.length > 1 && acceptedMaterial.uniforms.amount !== .8, 'Cloud fixture requires two materials and a distinct amount');
    live.amount(.8);
    const source = live.host.materialSession.getSnapshot().draftSource + '\n// cloud material preview source';
    live.host.materialSession.setDraftSource(source);
    const before = authority(live.host), camera = structuredClone(live.camera), expected: RenderNativeSceneDocument = {
      ...before.accepted, surfaceMaterials: before.accepted.surfaceMaterials.map(item => item.target.bodyId === bodyId
        ? {...item, material: {...item.material, shaderSource: source, uniforms: {...item.material.uniforms, amount: .8}, revision: item.material.revision + 1}} : item),
    };
    let observed = 0;
    const unsubscribe = live.host.subscribe(() => {
      if (live.host.getSnapshot().materialPreview) {equal(live.shown, expected, 'observer presentation'); equal(authority(live.host), before, 'observer authority'); observed++;}
    });
    const token = live.host.beginMaterialPreview();
    equal(live.shown, expected); equal(authority(live.host), before, 'Preview must not author'); equal(live.camera, camera);
    check(live.host.getSnapshot().materialPreview?.bodyId === bodyId && observed > 0, 'Preview snapshot/observer missing');
    for (const operation of [() => live.amount(.2), () => live.host.materialSession.setDraftSource(source + ' '),
      () => live.host.prepareDraft(), () => live.host.prepareUndo(), () => live.host.prepareRedo(),
      () => live.host.prepareOpen(text), () => live.host.discardDraft(), () => live.host.markSaved(initial.accepted.revision),
      () => live.host.selectTarget(initial.targets[1]!.bodyId), () => live.host.selectSurfacePole(0, 0),
      () => live.host.stageLighting(initial.accepted.display.lighting), () => live.host.duplicateSelectedBody(),
      () => live.host.removeSelectedBody(), () => live.host.resetViewportCamera(), () => live.host.applyCamera(),
      () => live.host.beginBodyPosePreview(bodyId), () => live.host.beginSurfacePoleDrag(bodyId, 0, 0),
      () => live.host.beginMaterialPreview()]) refuses(operation);
    unsubscribe();
    live.host.cancelMaterialPreview(token); equal(live.shown, before.accepted); equal(authority(live.host), before, 'Cancel retains raw and full draft'); equal(live.camera, camera);
    check(live.host.getSnapshot().dirty && live.host.getSnapshot().materialPreview === null, 'Cancel must close preview and retain dirty');
    refuses(() => live.host.cancelMaterialPreview(token));
    const applied = live.host.applyMaterialPreview(live.host.beginMaterialPreview());
    equal(applied.authored.document, {...expected, revision: expected.revision + 1}, 'ONE material/outer revision');
    check(!live.host.getSnapshot().dirty && live.host.getSnapshot().canUndo && live.host.getSnapshot().materialPreview === null, 'Apply must clear raw through whole scene');
    equal(live.camera, camera); equal(live.host.getSnapshot().accepted.nativeDocument, original.nativeDocument);
    const undo = live.host.prepareUndo(); check(undo, 'Undo missing'); live.host.commitPrepared(undo);
    equal(live.host.getSnapshot().accepted.surfaceMaterials, original.surfaceMaterials, 'Undo restores original materials');
    const redo = live.host.prepareRedo(); check(redo, 'Redo missing'); live.host.commitPrepared(redo);
    equal(live.host.getSnapshot().accepted.surfaceMaterials, expected.surfaceMaterials, 'Redo material change');
    const roundtrip = serializeRenderNativeSceneDocument(live.host.getSnapshot().accepted);
    const reopened = model(parseRenderNativeSceneDocument(roundtrip)); equal(reopened.host.getSnapshot().accepted, live.host.getSnapshot().accepted, 'CPU codec reopen'); reopened.host.dispose();

    for (const bad of ['invalid-source', 'NaN', 'range', 'clean'] as const) {
      const test = model(original);
      if (bad === 'invalid-source') test.host.materialSession.setDraftSource('@shader broken');
      else if (bad === 'NaN') test.amount(NaN);
      else if (bad === 'range') test.amount(2);
      const baseline = authority(test.host), calls = test.calls;
      refuses(() => test.host.beginMaterialPreview()); equal(authority(test.host), baseline, bad + ' preserves text/raw'); check(test.calls === calls, bad + ' presented'); test.host.dispose();
    }
    // Valid independent scene drafts remain rejected even when material raw also changed.
    for (const kind of ['pose', 'light', 'metadata', 'other-material', 'material-metadata', 'material-revision', 'source', 'target'] as const) {
      const test = model(original), draft = structuredClone(test.host.getSnapshot().accepted) as Mutable<RenderNativeSceneDocument>;
      if (kind === 'pose') {const pose = draft.display.poses[0]; check(pose, 'Fixture requires poses'); pose.translationMM[0] += 1;}
      if (kind === 'light') draft.display.lighting.ambientStrength += .01;
      if (kind === 'metadata') draft.title += ' changed';
      if (kind === 'other-material') draft.surfaceMaterials[1]!.material.uniforms.amount = .4;
      if (kind === 'material-metadata') draft.surfaceMaterials[0]!.material.title += ' changed';
      if (kind === 'material-revision') draft.surfaceMaterials[0]!.material.revision += 2;
      if (kind === 'source') draft.nativeDocument.assets[0]!.source += '\n// other source';
      if (kind === 'target') draft.surfaceMaterials[0]!.target.bodyId = 'missing_body';
      let staged = false;
      try {test.host.stageSceneDocument(draft); staged = true;} catch {check(kind === 'source' || kind === 'target', 'Unexpected baseline refusal: ' + kind);}
      if (staged) {
        // Source editing preserves unrelated metadata rather than replacing the selected material object.
        if (kind === 'material-metadata' || kind === 'material-revision') {
          test.amount(.8); // StageValidMaterial replaces selected metadata; restore it in the external draft is locked by clean().
          // These valid stage-only drafts have no material raw and still cannot begin.
          test.host.discardDraft(); test.host.stageSceneDocument(draft);
        } else test.amount(.8);
        const baseline = authority(test.host), calls = test.calls; refuses(() => test.host.beginMaterialPreview());
        equal(authority(test.host), baseline, kind + ' authority'); check(test.calls === calls, kind + ' presented');
      }
      test.host.dispose();
    }
    const retry = model(original); retry.amount(.8); const retryBefore = authority(retry.host), retryToken = retry.host.beginMaterialPreview();
    retry.fault(document => document.surfaceMaterials[0]!.material.revision === original.surfaceMaterials[0]!.material.revision);
    refuses(() => retry.host.cancelMaterialPreview(retryToken)); check(retry.host.getSnapshot().materialPreview && retry.host.getSnapshot().available, 'Restore failure must retain usable same token');
    equal(authority(retry.host), retryBefore); retry.fault(null); retry.host.cancelMaterialPreview(retryToken); equal(retry.shown, retryBefore.accepted);
    const applyRestore = retry.host.beginMaterialPreview(); retry.fault(document => document.surfaceMaterials[0]!.material.revision === original.surfaceMaterials[0]!.material.revision);
    refuses(() => retry.host.applyMaterialPreview(applyRestore)); check(retry.host.getSnapshot().materialPreview, 'Apply restore failure lost token'); retry.fault(null); retry.host.cancelMaterialPreview(applyRestore); retry.host.dispose();
    const failed = model(original); failed.amount(.8); const raw = failed.host.materialSession.getSnapshot(), failedBefore = failed.host.getSnapshot().accepted;
    const failedToken = failed.host.beginMaterialPreview(); failed.fault(document => document.revision > original.revision);
    refuses(() => failed.host.applyMaterialPreview(failedToken));
    check(failed.host.getSnapshot().accepted === failedBefore && failed.host.getSnapshot().materialPreview === null && failed.host.getSnapshot().dirty && failed.host.getSnapshot().available, 'Commit refusal must close preview and retain corrective draft');
    equal(failed.shown, failedBefore); equal(failed.host.materialSession.getSnapshot().draftSource, raw.draftSource); equal(failed.host.materialSession.getSnapshot().draftUniforms, raw.draftUniforms);
    failed.fault(null); failed.host.applyMaterialPreview(failed.host.beginMaterialPreview()); check(!failed.host.getSnapshot().dirty, 'Corrective draft retry failed'); failed.host.dispose();
    for (const kind of ['owner', 'camera', 'reader', 'reader-reentry', 'dispose', 'context-loss'] as const) {
      const stale = model(original); stale.amount(.8); const staleToken = stale.host.beginMaterialPreview(), calls = stale.calls, shown = stale.shown;
      if (kind === 'owner') stale.changeOwner(); if (kind === 'camera') stale.changeCamera(); if (kind === 'reader') stale.failReader();
      if (kind === 'reader-reentry') stale.reenterReader(); if (kind === 'dispose') stale.host.dispose(); if (kind === 'context-loss') stale.host.setAvailable(false);
      refuses(() => stale.host.cancelMaterialPreview(staleToken)); check(stale.calls === calls && stale.shown === shown && !stale.host.getSnapshot().available, kind + ' overwrote foreign/uncertain pixels'); stale.host.dispose();
    }
    for (const operation of ['begin', 'cancel', 'apply'] as const) for (const mode of ['reader', 'reentry'] as const) {
      const late = model(original); late.amount(.8); const token = operation === 'begin' ? null : late.host.beginMaterialPreview();
      const accepted = late.host.getSnapshot().accepted;
      late.after(() => {if (mode === 'reader') late.failReader(); else refuses(() => late.host.discardDraft());});
      refuses(() => operation === 'begin' ? late.host.beginMaterialPreview() : operation === 'cancel' ? late.host.cancelMaterialPreview(token!) : late.host.applyMaterialPreview(token!));
      check(!late.host.getSnapshot().available && late.host.getSnapshot().materialPreview === null && late.host.getSnapshot().accepted === accepted, 'Post-success uncertainty must quarantine ' + operation + '/' + mode);
      const calls = late.calls; if (token) refuses(() => late.host.cancelMaterialPreview(token)); check(late.calls === calls, 'Uncertain token restored'); late.host.dispose();
    }
    for (const phase of ['begin', 'restore', 'commit'] as const) for (const mode of ['thenable', 'then-getter', 'throw-after', 'reader', 'reentry'] as const) {
      const uncertain = model(original); uncertain.amount(.8);
      const pending = phase === 'begin' ? null : uncertain.host.beginMaterialPreview(), accepted = uncertain.host.getSnapshot().accepted;
      const after = () => {
        if (mode === 'reader') {uncertain.failReader(); return;}
        if (mode === 'reentry') {refuses(() => uncertain.host.discardDraft()); return;}
        if (mode === 'throw-after') throw Error('Declared non-atomic throw after presentation');
        if (mode === 'then-getter') return Object.defineProperty({}, 'then', {get() {throw Error('Thenable reflection failed after presentation');}});
        return {then() {throw Error('Thenable must never be awaited');}};
      };
      uncertain.after(phase === 'commit' ? () => uncertain.after(after) : after);
      refuses(() => phase === 'begin' ? uncertain.host.beginMaterialPreview()
        : phase === 'restore' ? uncertain.host.cancelMaterialPreview(pending!) : uncertain.host.applyMaterialPreview(pending!));
      check(!uncertain.host.getSnapshot().available && uncertain.host.getSnapshot().materialPreview === null
        && uncertain.host.getSnapshot().accepted === accepted, phase + '/' + mode + ' left uncertain pixels usable');
      const count = uncertain.calls; if (pending) refuses(() => uncertain.host.cancelMaterialPreview(pending));
      check(uncertain.calls === count, 'Uncertain callback restored with old token'); uncertain.host.dispose();
    }
    const foreign = model(original); foreign.amount(.8); const calls = foreign.calls;
    refuses(() => foreign.host.applyMaterialPreview(token)); refuses(() => foreign.host.cancelMaterialPreview({})); check(foreign.calls === calls, 'Foreign/forged token presented'); foreign.host.dispose();
    live.host.dispose(); check(browserGlobalReads.length === 0, 'Pure flow used browser');
    prepareRenderNativeSceneAppearance(original);
    return {scope, browserGlobalReads, bodyId, observed, cloudFixtureRevision: original.revision,
      checks: ['Selected source/uniform-only preview, exact authority preservation, Cancel raw retention, repeated Preview/Apply one full revision and whole history.',
        'Invalid source/numeric/clean and unrelated native/material/metadata drafts refused before presentation; all ordinary editing actions locked.',
        'Atomic restore retry, corrective raw after whole commit failure, owner/camera/reader/reentry/foreign/used/disposed/context-loss quarantine.',
        'Actual public codec/preparation reopening in CPU only; physical files, UI lexical 0.8000, same Canvas and actual color remain UNRUN.']};
  } finally {for (const [key, descriptor] of descriptors) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
