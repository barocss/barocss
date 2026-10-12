import {createRenderMaterialController, createRenderMaterialSession, deriveRenderMaterialAssignment,
  parseRenderMaterialDocument, prepareRenderMaterialDocument, serializeRenderMaterialDocument,
  parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, RENDER_MATERIAL_LIMITS} from '@barocss/render-editor';
import type {RenderMaterialDocument, RenderNativeSceneDocument} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

const scope = 'Actual material codec, session/controller and Native host with an atomic CPU presenter. No browser, GPU pixels, native picker or saved-file persistence acceptance.';
function check(value: unknown, message: string): asserts value {if (!value) throw Error(message);}
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs');
  const keys = Object.keys(a), other = Object.keys(b);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ');
  for (const key of keys) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function refuses(operation: () => unknown, label: string): void {try {operation();} catch {return;} throw Error('Expected refusal: ' + label);}
function portableMaterial(target: RenderMaterialDocument): RenderMaterialDocument {
  return {...target, documentId: 'portable_other_identity', title: 'Portable other title', revision: 71,
    shaderSource: '// Portable exact CRLF, omitted defaults and signed zero.\r\n@shader #portable {\r\n  @uniform mixLevel: float(0, 1, .25);\r\n  @uniform signed: float(-1, 1, 0);\r\n  @uniform omitted: float(0, 1, .5);\r\n  @fragment { color: mix(#ff0000, #0000ff, mixLevel); }\r\n}\r\n', uniforms: {mixLevel: .8, signed: -0}};
}
function model(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document);
  let shown = document, view: MeshCamera = structuredClone(document.display.camera), owner: object = {}, calls = 0;
  host.setPresenter((prepared, override) => {
    const request = prepareNativeViewportAppearance(prepared, override);
    shown = prepared.authored.document; view = structuredClone(request.display.camera); owner = {}; calls++;
  }, () => owner, () => view);
  host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document)));
  view = structuredClone(view); view.eye[0] += .5; host.observeView(view);
  return {host, get shown() {return shown;}, get camera() {return view;}, get calls() {return calls;}};
}

/** Feed tracked public native-scene fixture bytes; the launcher records provenance and hash. */
export function runNativeMaterialTransferFlow(text: string) {
  const browserGlobalReads: string[] = [], descriptors = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {browserGlobalReads.push(key); throw Error('CPU flow read ' + key);}});
    }
    const original = parseRenderNativeSceneDocument(text), target = original.surfaceMaterials[0]!.material;
    check(original.surfaceMaterials.length > 1 && Object.hasOwn(target.uniforms, 'amount'), 'Fixture needs two bound materials and amount');
    const portable = portableMaterial(target), wire = serializeRenderMaterialDocument(portable), decoded = parseRenderMaterialDocument(wire);
    equal(decoded, portable, 'Portable public-codec roundtrip');
    check(decoded.shaderSource === portable.shaderSource && Object.is(decoded.uniforms.signed, -0) && !Object.hasOwn(decoded.uniforms, 'omitted'), 'Codec lost exact source, signed zero or supplied omission');
    refuses(() => prepareRenderMaterialDocument({...target, shaderSource: portable.shaderSource}), 'new source with old overrides');
    refuses(() => prepareRenderMaterialDocument({...target, uniforms: portable.uniforms}), 'old source with new overrides');
    const assigned = deriveRenderMaterialAssignment(target, decoded);
    equal(assigned, {...target, shaderSource: portable.shaderSource, uniforms: portable.uniforms}, 'Owned-copy metadata');
    check(assigned !== target && assigned.uniforms !== portable.uniforms && Object.isFrozen(assigned.uniforms), 'Assignment must own immutable copies');
    equal(target, original.surfaceMaterials[0]!.material, 'Target remains untouched'); equal(decoded, portable, 'Portable remains untouched');
    const mutablePortable = {...portable, uniforms: {...portable.uniforms}}, copied = deriveRenderMaterialAssignment(target, mutablePortable);
    mutablePortable.uniforms.mixLevel = .1; check(copied.uniforms.mixLevel === .8, 'Assignment aliases caller uniform record');

    let getterCalls = 0;
    const getterUniforms = Object.defineProperty({}, 'mixLevel', {enumerable: true, get() {getterCalls++; return .8;}}) as Record<string, number>;
    const getterDocument = Object.defineProperty({...portable}, 'shaderSource', {enumerable: true, get() {getterCalls++; return portable.shaderSource;}});
    const hiddenUniform = Object.defineProperty({mixLevel: .8}, 'hidden', {value: 1});
    const tooMany = Object.fromEntries(Array.from({length: 17}, (_, index) => ['u' + index, 0]));
    const badDocuments = [getterDocument, {...portable, uniforms: getterUniforms}, {...portable, uniforms: hiddenUniform},
      {...portable, uniforms: {...portable.uniforms, [Symbol('hidden')]: 0}}, {...portable, uniforms: tooMany},
      {...portable, uniforms: {mixLevel: NaN}}, {...portable, uniforms: {mixLevel: Infinity}}, {...portable, uniforms: {mixLevel: 2}},
      {...portable, uniforms: {unknown: .8}}, {...portable, shaderSource: '@shader broken'}, {...portable, shaderSource: 'é'.repeat(32769)},
      {...portable, documentId: '../escape'}, {...portable, profile: 'unsupported'}, {...portable, version: 1}, {...portable, future: true}];
    for (const invalid of badDocuments) {
      refuses(() => deriveRenderMaterialAssignment(target, invalid as RenderMaterialDocument), 'invalid portable');
      refuses(() => deriveRenderMaterialAssignment(invalid as RenderMaterialDocument, portable), 'invalid target');
    }
    for (const invalid of ['{broken', ' '.repeat(RENDER_MATERIAL_LIMITS.fileBytes + 1), 'é'.repeat(RENDER_MATERIAL_LIMITS.fileBytes / 2 + 1), JSON.stringify({...portable, profile: 'unsupported'})]) {
      refuses(() => parseRenderMaterialDocument(invalid), 'invalid portable bytes');
    }
    const escaped = {...portable, shaderSource: portable.shaderSource + '/*' + '\u0001'.repeat(50000) + '*/'};
    prepareRenderMaterialDocument(escaped);
    refuses(() => serializeRenderMaterialDocument(escaped), 'serialized byte limit');
    check(getterCalls === 0, 'Data getters executed');

    const cpu = createRenderMaterialSession(target), cpuInitial = cpu.getSnapshot();
    let cpuNotices = 0; const observedCpu: Array<ReturnType<typeof cpu.getSnapshot>> = [];
    cpu.subscribe(() => {cpuNotices++; observedCpu.push(cpu.getSnapshot());});
    cpu.setDraftMaterial(portable.shaderSource, portable.uniforms);
    check(observedCpu.length === 1 && observedCpu[0]!.draftSource === portable.shaderSource && observedCpu[0]!.draftUniforms.mixLevel === .8, 'Session exposed half a pair');
    check(cpuNotices === 1 && cpu.getSnapshot().accepted === cpuInitial.accepted && cpu.getSnapshot().dirty && !cpu.getSnapshot().canUndo, 'Session pair did not publish exactly once as draft');
    const cpuStaged = cpu.getSnapshot();
    for (const invalid of [getterUniforms, {unknown: 1}, {mixLevel: NaN}, {mixLevel: 2}]) {
      refuses(() => cpu.setDraftMaterial(target.shaderSource, invalid), 'atomic second-field failure');
      check(cpu.getSnapshot() === cpuStaged && cpuNotices === 1, 'Refused pair changed session or notified');
    }
    refuses(() => cpu.setDraftMaterial('@shader broken', target.uniforms), 'invalid first field');
    check(cpu.getSnapshot() === cpuStaged && getterCalls === 0, 'Failed first field/getter mutated session');
    cpu.dispose(); refuses(() => cpu.setDraftMaterial(portable.shaderSource, portable.uniforms), 'disposed session');

    const controlledCpu = createRenderMaterialSession(target), controller = createRenderMaterialController(controlledCpu);
    let presentations = 0, controlledNotices = 0, reentryRefused = false;
    controller.setPresenter(() => {presentations++;});
    controller.editorSession.subscribe(() => {
      controlledNotices++; try {controller.editorSession.setDraftMaterial(target.shaderSource, target.uniforms);} catch {reentryRefused = true;}
    });
    controller.editorSession.setDraftMaterial(portable.shaderSource, portable.uniforms);
    check(controlledNotices === 1 && presentations === 1 && reentryRefused, 'Controller pair bypassed transaction guard or presented a draft');
    const controlled = controlledCpu.getSnapshot();
    refuses(() => controller.editorSession.setDraftMaterial(target.shaderSource, portable.uniforms), 'controller invalid pair');
    check(controlledCpu.getSnapshot() === controlled && controlledNotices === 1, 'Controller refusal mutated session');
    controller.dispose(); refuses(() => controller.editorSession.setDraftMaterial(portable.shaderSource, portable.uniforms), 'disposed controller'); controlledCpu.dispose();

    const live = model(original), before = live.host.getSnapshot(), localBefore = live.host.materialSession.getSnapshot(), shown = live.shown, calls = live.calls;
    const bodyId = before.selectedBodyId, camera = structuredClone(live.camera);
    let hostNotices = 0, materialNotices = 0; const observedPairs: Array<{state: ReturnType<typeof live.host.getSnapshot>; raw: ReturnType<typeof live.host.materialSession.getSnapshot>}> = [];
    const stopHost = live.host.subscribe(() => {
      hostNotices++; const state = live.host.getSnapshot(), raw = live.host.materialSession.getSnapshot();
      observedPairs.push({state, raw});
    });
    const stopMaterial = live.host.materialSession.subscribe(() => {materialNotices++;});
    live.host.stageMaterialAssignment(decoded, before); stopHost(); stopMaterial();
    const staged = live.host.getSnapshot(), stagedRaw = live.host.materialSession.getSnapshot();
    check(hostNotices === 1 && materialNotices === 1, 'Host assignment did not publish one complete notification');
    for (const {state, raw} of observedPairs) {
      equal(state.draftDocument.surfaceMaterials.find(item => item.target.bodyId === bodyId)!.material, assigned, 'Complete observed native draft');
      check(raw.draftSource === portable.shaderSource && raw.draftUniforms.mixLevel === .8, 'Host exposed half local pair');
    }
    check(staged.accepted === before.accepted && staged.preparation === before.preparation && stagedRaw.accepted === localBefore.accepted, 'Import replaced accepted authority');
    equal(staged.draftDocument, {...before.accepted, surfaceMaterials: before.accepted.surfaceMaterials.map(binding => binding.target.bodyId === bodyId ? {...binding, material: assigned} : binding)}, 'Only selected draft values change');
    check(staged.savedRevision === before.savedRevision && staged.canUndo === before.canUndo && staged.canRedo === before.canRedo && staged.selectedBodyId === bodyId, 'Import changed saved/history/selection');
    check(live.shown === shown && live.calls === calls, 'Import presented'); equal(staged.viewCamera, before.viewCamera); equal(live.camera, camera);
    for (const invalid of badDocuments) {
      const test = model(original), state = test.host.getSnapshot(), raw = test.host.materialSession.getSnapshot(), count = test.calls;
      refuses(() => test.host.stageMaterialAssignment(invalid as RenderMaterialDocument, state), 'invalid host assignment');
      check(test.host.getSnapshot() === state && test.host.materialSession.getSnapshot() === raw && test.calls === count, 'Invalid host assignment is not atomic'); test.host.dispose();
    }
    const failedPair = model(original), pairBefore = failedPair.host.getSnapshot(), pairRaw = failedPair.host.materialSession.getSnapshot();
    refuses(() => failedPair.host.materialSession.setDraftMaterial(portable.shaderSource, target.uniforms), 'host facade bad second field');
    check(failedPair.host.getSnapshot() === pairBefore && failedPair.host.materialSession.getSnapshot() === pairRaw, 'Host facade pair refusal changed live authority');
    failedPair.host.materialSession.setDraftMaterial(portable.shaderSource, portable.uniforms);
    check(failedPair.host.getSnapshot().materialDirty, 'Host facade did not support strict pair'); failedPair.host.dispose();

    const token = live.host.beginMaterialPreview();
    check(live.host.getSnapshot().accepted === before.accepted && live.host.getSnapshot().draftDocument === staged.draftDocument, 'Preview authored imported draft');
    live.host.cancelMaterialPreview(token);
    check(live.host.getSnapshot().accepted === before.accepted, 'Cancel authored import');
    equal(live.host.materialSession.getSnapshot().draftUniforms, stagedRaw.draftUniforms); check(live.host.materialSession.getSnapshot().draftSource === stagedRaw.draftSource, 'Cancel lost imported source');
    equal(live.camera, camera);
    live.host.applyMaterialPreview(live.host.beginMaterialPreview());
    const applied = live.host.getSnapshot();
    equal(applied.accepted, {...before.accepted, revision: before.accepted.revision + 1, surfaceMaterials: before.accepted.surfaceMaterials.map(binding => binding.target.bodyId === bodyId ? {...binding, material: {...assigned, revision: assigned.revision + 1}} : binding)}, 'One scene/material revision');
    check(!applied.dirty && applied.canUndo && !applied.canRedo && applied.savedRevision === before.savedRevision, 'Apply history/saved contract');
    equal(live.camera, camera); equal(applied.accepted.display.camera, before.accepted.display.camera, 'Authored camera retention');
    const undo = live.host.prepareUndo(); check(undo, 'Missing whole-scene Undo'); live.host.commitPrepared(undo);
    equal(live.host.getSnapshot().accepted.surfaceMaterials, before.accepted.surfaceMaterials, 'Undo restores authored values');
    check(!live.host.getSnapshot().canUndo && live.host.prepareUndo() === null, 'Import manufactured more than one history entry');
    const redo = live.host.prepareRedo(); check(redo, 'Missing whole-scene Redo'); live.host.commitPrepared(redo);
    equal(live.host.getSnapshot().accepted.surfaceMaterials, applied.accepted.surfaceMaterials, 'Redo restores imported values');
    equal(parseRenderNativeSceneDocument(serializeRenderNativeSceneDocument(live.host.getSnapshot().accepted)), live.host.getSnapshot().accepted, 'Complete scene codec roundtrip'); live.host.dispose();

    for (const exhausted of ['neither', 'material', 'scene', 'both'] as const) {
      const document = {...original, revision: exhausted === 'scene' || exhausted === 'both' ? 2147483647 : original.revision,
        surfaceMaterials: original.surfaceMaterials.map((binding, index) => index === 0 && (exhausted === 'material' || exhausted === 'both') ? {...binding, material: {...binding.material, revision: 2147483647}} : binding)};
      const test = model(document), state = test.host.getSnapshot(), raw = test.host.materialSession.getSnapshot(), same = state.accepted.surfaceMaterials[0]!.material;
      let notices = 0; test.host.subscribe(() => {notices++;});
      test.host.stageMaterialAssignment({...same, documentId: 'ignored_same_values', title: 'Ignored', revision: 100}, state);
      check(test.host.getSnapshot() === state && test.host.materialSession.getSnapshot() === raw && !state.dirty && notices === 0, exhausted + ' no-op changed authority');
      if (exhausted !== 'neither') {refuses(() => test.host.stageMaterialAssignment(portable, state), exhausted + ' overflow'); check(test.host.getSnapshot() === state && test.host.materialSession.getSnapshot() === raw && notices === 0, exhausted + ' overflow changed authority');}
      test.host.dispose();
    }
    for (const kind of ['foreign', 'forged', 'away-back', 'draft-discard', 'saved', 'view', 'dirty', 'pose', 'pole', 'preview', 'unavailable', 'no-presenter', 'disposed'] as const) {
      const test = model(original), captured = test.host.getSnapshot(); let expected = captured;
      if (kind === 'foreign') {const foreign = model(original); expected = foreign.host.getSnapshot(); foreign.host.dispose();}
      if (kind === 'forged') expected = {...captured};
      if (kind === 'away-back') {test.host.selectTarget(captured.targets[1]!.bodyId); test.host.selectTarget(captured.selectedBodyId);}
      if (kind === 'draft-discard') {test.host.materialSession.setDraftSource(target.shaderSource + '\n'); test.host.discardDraft();}
      if (kind === 'saved') test.host.markSaved(captured.accepted.revision);
      if (kind === 'view') {const view = structuredClone(test.camera); view.eye[0] += .1; test.host.observeView(view);}
      if (kind === 'dirty' || kind === 'preview') test.host.materialSession.setDraftMaterial(portable.shaderSource, portable.uniforms);
      if (kind === 'pose') test.host.beginBodyPosePreview(captured.selectedBodyId);
      if (kind === 'pole') {test.host.duplicateSelectedBody(); test.host.beginSurfacePoleDrag(test.host.getSnapshot().selectedBodyId, 0, 0);}
      if (kind === 'preview') test.host.beginMaterialPreview();
      if (kind === 'unavailable') test.host.setAvailable(false);
      if (kind === 'no-presenter') {test.host.setPresenter(null); test.host.setAvailable(true);}
      if (kind === 'disposed') test.host.dispose();
      const state = test.host.getSnapshot(), raw = test.host.materialSession.getSnapshot(), count = test.calls;
      if (['dirty', 'pose', 'pole', 'preview', 'unavailable', 'no-presenter', 'disposed'].includes(kind)) expected = state;
      refuses(() => test.host.stageMaterialAssignment(portable, expected), kind);
      check(test.host.getSnapshot() === state && test.host.materialSession.getSnapshot() === raw && test.calls === count, kind + ' refusal changed authority'); test.host.dispose();
    }
    const reentrant = model(original), reflectionBefore = reentrant.host.getSnapshot(), reflectionRaw = reentrant.host.materialSession.getSnapshot();
    let reflectionAttempts = 0;
    const reflected = new Proxy(portable, {getPrototypeOf(value) {
      reflectionAttempts++; refuses(() => reentrant.host.discardDraft(), 'provider reflection reentry'); return Reflect.getPrototypeOf(value);
    }});
    refuses(() => reentrant.host.stageMaterialAssignment(reflected, reflectionBefore), 'provider reflection must not publish');
    check(reflectionAttempts > 0 && reentrant.host.getSnapshot() === reflectionBefore && reentrant.host.materialSession.getSnapshot() === reflectionRaw, 'Provider reflection reentry changed live state');
    reentrant.host.dispose();
    const observerFailure = model(original); observerFailure.host.subscribe(() => {throw Error('Declared observer failure');});
    observerFailure.host.stageMaterialAssignment(portable, observerFailure.host.getSnapshot());
    check(observerFailure.host.getSnapshot().dirty && observerFailure.host.materialSession.getSnapshot().draftSource === portable.shaderSource, 'Observer failure undid completed stage'); observerFailure.host.dispose();
    const unpresented = createNativeSceneHost(original); unpresented.setPresenter(() => {});
    const unpresentedBefore = unpresented.getSnapshot(); refuses(() => unpresented.stageMaterialAssignment(portable, unpresentedBefore), 'not presented'); check(unpresented.getSnapshot() === unpresentedBefore, 'Unpresented assignment changed draft'); unpresented.dispose();
    check(getterCalls === 0 && browserGlobalReads.length === 0, 'Getters or browser globals executed');
    return {scope, browserGlobalReads, bodyId, hostNotices, materialNotices, fixtureRevision: original.revision, checks: [
      'Exact public codec source/CRLF, supplied omission/-0, owned target identity and descriptor/limit refusals.',
      'Paired-only-valid source/overrides across real session, guarded controller and Native facade; atomic failures and one complete stage notification.',
      'Accepted/native context/source/TEN/geometry/other bodies, saved/history, current/authored camera retained before Apply.',
      'Preview/Cancel retains staged values; Apply advances one material/scene revision and one whole-scene Undo/Redo entry.',
      'No-op including exhausted revisions; changed overflow; stale/foreign/forged/away-back/dirty/gesture/preview/unavailable/disposed guards.',
    ]};
  } finally {for (const [key, descriptor] of descriptors) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
