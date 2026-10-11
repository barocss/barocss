import {deriveRenderNativeSceneSurfaceAddition, deriveRenderNativeSceneBodyDuplicate, deriveRenderNativeSceneBodyRemoval,
  prepareRenderNativeSourceImport, prepareRenderNativeSceneAppearance, validateRenderNativeSceneDocument,
  serializeRenderNativeSceneDocument, parseRenderNativeSceneDocument, deriveRenderCameraInteraction} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneSurfaceAdditionOptions} from '@barocss/render-editor';
import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** Private launcher owns actual five-package graph receipts, first failures, files and cold processes. */
export interface NativeSurfaceAddFlowResult {
  readonly scope: string; readonly checks: readonly string[]; readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string; readonly secondFileText?: string; readonly firstRevision?: number; readonly secondRevision?: number;
  readonly addedBodyId?: string;
}
const A = 'body_preview_a', B = 'body_preview_b', SURFACE = 'reference_panel';
const scope = 'Real public Source0 import/Add/CAD/Interop/appearance and private host CPU protocol. Actual Viewer public camera preflight, model presentation only; no Viewer instance/GL/pixels/browser/filechooser proof. Complete authored files contain original source, not runtime buffers.';
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
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes(SURFACE), 'Supply genuine322B reference; launcher verifies original SHA.');
  return createNativeSceneSeed(createNativeSceneBase(source, clone(material), clone(camera), clone(lighting), identity));
}
function parent(source: string, identity?: {documentId: string; title: string}): RenderNativeSceneDocument {
  const original = seed(source, identity), duplicate = deriveRenderNativeSceneBodyDuplicate(original, B), removed = deriveRenderNativeSceneBodyRemoval(duplicate.document, duplicate.bodyId);
  return validateRenderNativeSceneDocument({...removed, display: {...removed.display, poses: removed.display.poses.map(pose => pose.bodyId === B ? {...pose, translationMM: [1050, -0, 0], scale: [1.1, 1, 1]} : pose)},
    surfaceMaterials: removed.surfaceMaterials.map(item => item.target.bodyId === B ? {...item, material: {...item.material, revision: item.material.revision + 1, uniforms: {amount: .6}}} : item)});
}
function added(document: RenderNativeSceneDocument): string {const bodies = document.nativeDocument.bodies.filter(body => body.id !== A && body.id !== B); check(bodies.length === 1, 'Expected exactly one imported body.'); return bodies[0]!.id;}
function qualified(document: RenderNativeSceneDocument): void {
  const prepared = prepareRenderNativeSceneAppearance(document); check(prepared.authored.entries.length === document.nativeOptions.bodyIds!.length, 'Real inventory changed.');
  for (const entry of prepared.authored.entries) {
    const bound = document.surfaceMaterials.find(item => item.target.bodyId === entry.binding.bodyId)!; check(bound, 'Actual material target missing.');
    for (const key of ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'] as const) equal(bound.target[key], entry.binding[key], 'real seven-field TEN target');
  }
  equal(parseRenderNativeSceneDocument(serializeRenderNativeSceneDocument(document)), document, 'codec and numeric signed zero');
}
function preserved(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title'] as const) equal(document[key], original[key]);
  for (const key of ['schema', 'version', 'profile', 'documentId', 'units', 'nativeFrame', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches'] as const) equal(document.nativeDocument[key], original.nativeDocument[key]);
  equal(document.nativeOptions.native, original.nativeOptions.native); equal(document.nativeOptions.basis, original.nativeOptions.basis);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'lighting', 'basis'] as const) equal(document.display[key], original.display[key]);
  for (const asset of original.nativeDocument.assets) equal(document.nativeDocument.assets.find(item => item.id === asset.id), asset, 'entire surviving source asset');
  for (const body of original.nativeDocument.bodies) equal(document.nativeDocument.bodies.find(item => item.id === body.id), body);
  for (const id of [A, B]) {
    equal(document.display.poses.find(item => item.bodyId === id), original.display.poses.find(item => item.bodyId === id), 'original pose/q');
    const current = document.surfaceMaterials.find(item => item.target.bodyId === id)!, before = original.surfaceMaterials.find(item => item.target.bodyId === id)!;
    equal(current.material, before.material, 'old whole material'); equal({...current.target, documentRevision: before.target.documentRevision}, before.target);
    check(current.target.documentRevision === document.nativeDocument.revision, 'Original target not regenerated.');
  }
  qualified(document);
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document), model = {camera: clone(document.display.camera), owner: {} as object, shown: host.getSnapshot().accepted, calls: 0, fail: false};
  host.setPresenter((prepared, override) => {model.calls++; const actual = prepareViewerNativeSceneAppearance(prepareNativeViewportAppearance(prepared, override), prepared.context);
    if (model.fail) {model.fail = false; throw new Error('Declared CPU presenter refusal');} model.camera = clone(actual.display.camera); model.owner = {}; model.shown = prepared.authored.document;
  }, () => model.owner, () => clone(model.camera)); host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document))); return {host, model, close: () => host.dispose()};
}
function edit(host: ReturnType<typeof createNativeSceneHost>, bodyId: string, second = false): void {
  host.selectTarget(bodyId); const before = host.getSnapshot().accepted, pose = before.display.poses.find(item => item.bodyId === bodyId)!;
  host.stageBodyPose(bodyId, {translationMM: [second ? 2950 : 2800, pose.translationMM[1], pose.translationMM[2]], scale: [second ? 1.2 : 1, pose.scale[1], pose.scale[2]]});
  host.materialSession.setDraftUniforms({amount: second ? .4 : .2}); host.commitPrepared(host.prepareDraft()); check(host.getSnapshot().accepted.revision === before.revision + 1, 'Imported-body edit must accept once.');
}

export function runNativeSurfaceAddFlow(referenceSource: string): NativeSurfaceAddFlowResult {
  const reads: string[] = [], checks: string[] = []; return guarded(reads, () => {
    const original = parent(referenceSource), inspection = prepareRenderNativeSourceImport(referenceSource), bytes = serializeRenderNativeSceneDocument(original);
    check(inspection.source === referenceSource && inspection.sourceVersion === 0 && inspection.modelId === 'cloth_reference_981' && inspection.surfaces[0]!.id === SURFACE, 'Actual original Source0 inspection changed.');
    const result = deriveRenderNativeSceneSurfaceAddition(original, referenceSource, SURFACE); check(Object.isFrozen(result.document) && result.document.revision === original.revision && result.document.nativeDocument.revision === 4, 'Addition revision/frozen policy changed.'); preserved(result.document, original);
    const asset = result.document.nativeDocument.assets.find(item => item.id === result.assetId)!, body = result.document.nativeDocument.bodies.find(item => item.id === result.bodyId)!, mat = result.document.surfaceMaterials.find(item => item.target.bodyId === result.bodyId)!.material;
    check(asset.source === referenceSource && asset.revision === 0 && body.assetId === result.assetId && body.geometryId === SURFACE && mat.revision === 0 && mat.documentId === result.materialDocumentId, 'Whole source/newasset0/body/material0 mismatch.');
    equal({...mat, documentId: original.surfaceMaterials[0]!.material.documentId, revision: original.surfaceMaterials[0]!.material.revision}, original.surfaceMaterials[0]!.material, 'default applied material copy');
    equal(result.document.display.poses.find(item => item.bodyId === result.bodyId), {bodyId: result.bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]}, 'genuine no-offset identity pose');
    const ids = [result.bodyId, result.assetId, result.materialDocumentId], reserved = deriveRenderNativeSceneSurfaceAddition(original, referenceSource, SURFACE, {reservedIds: [...ids, ids[0]!]}); check([reserved.bodyId, reserved.assetId, reserved.materialDocumentId].every(id => !ids.includes(id) && id.length <= 48), 'Global reserved IDs reused.');
    check(serializeRenderNativeSceneDocument(original) === bytes, 'Original document mutated.');
    const end = referenceSource.lastIndexOf('}'), start = referenceSource.indexOf('@surface'), sibling = referenceSource.slice(start, end).replace('#reference_panel', '#retained_panel');
    const whole = '/* Whole-model import witness. */\r\n' + referenceSource.slice(0, end).replaceAll('-700', '-700.0') + sibling + '\n@curve #kept_path {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[-2,5,0],[6,5,0]];weights:[1,1];}\n' + referenceSource.slice(end);
    const all = prepareRenderNativeSourceImport(whole); check(all.objects.length === 3 && all.surfaces.length === 2, 'Actual sibling inventory missing.'); const retained = deriveRenderNativeSceneSurfaceAddition(original, whole, SURFACE); check(retained.document.nativeDocument.assets.find(item => item.id === retained.assetId)!.source === whole, 'Whole comments/siblings/numeric spelling lost.'); preserved(retained.document, original);
    checks.push('Actual Source0 inventory/fullModel source322, newasset0/identity/material0/NativeCAD+1/outer unchanged and real TEN; copied default material; reserved collision; original A/B1050-scale1.1-amount.6 exact; whole comments/Surface+Curve siblings/native numeric spelling retained.');

    let getters = 0; const unsafe = {}; Object.defineProperty(unsafe, 'name', {enumerable: true, get() {getters++; throw new Error('Unsafe options');}});
    refuses(() => deriveRenderNativeSceneSurfaceAddition({...original, format: 'wrong'} as unknown as RenderNativeSceneDocument, referenceSource, SURFACE, unsafe)); refuses(() => deriveRenderNativeSceneSurfaceAddition(original, referenceSource, SURFACE, unsafe)); check(getters === 0, 'Options getter invoked.');
    for (const option of [{name: 'x'.repeat(129)}, {reservedIds: Array(1)}, {reservedIds: ['bad id']}, {reservedIds: Array.from({length: 2049}, () => 'held')}, {extra: 1}, {[Symbol('x')]: 1}, {material: {...material, uniforms: Object.fromEntries([['__proto__', .5]])}}]) refuses(() => deriveRenderNativeSceneSurfaceAddition(original, referenceSource, SURFACE, option as unknown as RenderNativeSceneSurfaceAdditionOptions));
    for (const source of ['', referenceSource + '\n/*' + 'x'.repeat(65536) + '*/', referenceSource + '\n/*' + 'é'.repeat(33000) + '*/', referenceSource.replace('length-unit: mm', 'length-unit: cm'), '@model curve_only {version:0;length-unit:mm;@curve #path {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}}']) refuses(() => deriveRenderNativeSceneSurfaceAddition(original, source, SURFACE));
    refuses(() => deriveRenderNativeSceneSurfaceAddition(original, referenceSource, 'unknown_surface')); refuses(() => deriveRenderNativeSceneSurfaceAddition(original, whole, 'kept_path'));
    const tinyDecimal = '0.' + '0'.repeat(49) + '1', tinySource = referenceSource.replaceAll('-700,-550', tinyDecimal + ',-550');
    check(prepareRenderNativeSourceImport(tinySource).modelId === 'cloth_reference_981', 'F32 fixture must pass actual Source0 import first.');
    let f32Failure: unknown; try {deriveRenderNativeSceneSurfaceAddition(original, tinySource, SURFACE);} catch (cause) {f32Failure = cause;}
    let actualUnderflow = false; for (let error = f32Failure, depth = 0; error && depth < 8; depth++) {
      const row = error as {message?: string; cause?: unknown}; if (row.message === 'Native Surface coordinate underflows in Float32 display') actualUnderflow = true; error = row.cause;
    }
    check(actualUnderflow, 'Expected actual Native Float32 underflow cause, not Source0 syntax refusal.');
    const overflow = validateRenderNativeSceneDocument({...original, nativeDocument: {...original.nativeDocument, revision: 2147483647}, surfaceMaterials: original.surfaceMaterials.map(item => ({...item, target: {...item.target, documentRevision: 2147483647}}))}); refuses(() => deriveRenderNativeSceneSurfaceAddition(overflow, referenceSource, SURFACE));
    const four = deriveRenderNativeSceneSurfaceAddition(result.document, referenceSource, SURFACE).document; refuses(() => deriveRenderNativeSceneSurfaceAddition(four, referenceSource, SURFACE));
    refuses(() => deriveRenderNativeSceneSurfaceAddition({...original, nativeOptions: {...original.nativeOptions, native: {...original.nativeOptions.native, countU: 18}}}, referenceSource, SURFACE));
    checks.push('Descriptor/getter0/options/material, actual65536 codeunit/UTF8 importer (distinct from CAD262144), unknown/Curve-only/units, real F32 source, overflow/current4caps/Interop17 refusals.');

    const h = harness(original); h.host.selectTarget(B); const local = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 24, deltaY: -14, width: 900, height: 600}); h.model.camera = clone(local); h.host.observeView(local);
    const before = h.host.getSnapshot().accepted; h.host.addSurface(referenceSource, SURFACE); const imported = h.host.getSnapshot().accepted, id = added(imported);
    check(imported.revision === before.revision + 1 && h.host.getSnapshot().selectedBodyId === id && imported.surfaceMaterials.length === 3, 'Add must accept once/select genuine imported body.'); preserved(imported, original); equal(h.model.camera, local);
    const selected = imported.surfaceMaterials.find(item => item.target.bodyId === id)!.material, template = original.surfaceMaterials.find(item => item.target.bodyId === B)!.material;
    equal({...selected, documentId: template.documentId, revision: template.revision}, template, 'host applied selected material clone');
    h.host.commitPrepared(h.host.prepareUndo()!); equal(h.host.getSnapshot().accepted.nativeDocument, original.nativeDocument); h.host.commitPrepared(h.host.prepareRedo()!); check(added(h.host.getSnapshot().accepted) === id, 'Redo import identity changed.'); equal(h.model.camera, local);
    edit(h.host, id); const first = h.host.getSnapshot().accepted, firstFileText = serializeRenderNativeSceneDocument(first); preserved(first, original); h.close();
    const failed = harness(original); failed.host.selectTarget(B); const accepted = failed.host.getSnapshot().accepted, calls = failed.model.calls; failed.model.fail = true; refuses(() => failed.host.addSurface(referenceSource, SURFACE)); check(failed.host.getSnapshot().accepted === accepted && failed.host.getSnapshot().selectedBodyId === B && failed.host.getSnapshot().nativeDirty && failed.model.calls === calls + 1, 'Refused Add lost old scene/selected body/corrective draft.'); equal(failed.model.shown, accepted);
    const stale = failed.host.prepareDraft(); failed.host.discardDraft(); const count = failed.model.calls; refuses(() => failed.host.commitPrepared(stale)); check(failed.model.calls === count, 'Stale import candidate presented.'); failed.host.materialSession.setDraftUniforms({amount: NaN}); const raw = failed.host.materialSession.getSnapshot(); refuses(() => failed.host.addSurface(referenceSource, SURFACE)); check(failed.host.materialSession.getSnapshot() === raw, 'Add consumed invalid raw.'); failed.host.discardDraft(); failed.model.owner = {}; const ownerCalls = failed.model.calls; refuses(() => failed.host.addSurface(referenceSource, SURFACE)); check(failed.model.calls === ownerCalls, 'Foreign owner Add presented.'); failed.close();
    checks.push('Published host ONE Add with selected-applied independent material and current view; whole UndoRedo; imported-only numeric/material ONE Apply; rejected presentation retains corrective draft/old body/frame, stale/raw/owner refuses; FIRST whole codec JSON.');
    return {scope, checks, browserGlobalReads: reads, firstFileText, firstRevision: first.revision, addedBodyId: id};
  });
}

export function runNativeSurfaceAddColdFlow(referenceSource: string, firstText: string): NativeSurfaceAddFlowResult {
  const reads: string[] = []; return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = parent(referenceSource, {documentId: first.documentId, title: first.title}); preserved(first, original); check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST not actual canonical codec.');
    const h = harness(original); h.host.commitPrepared(h.host.prepareOpen(firstText)); check(!h.host.getSnapshot().canUndo && h.host.getSnapshot().savedRevision === first.revision, 'Cold Open history/saved reset failed.');
    const id = added(first), local = deriveRenderCameraInteraction(h.model.camera, {kind: 'orbit', deltaX: 18, deltaY: -12, width: 900, height: 600}); h.model.camera = clone(local); h.host.observeView(local); edit(h.host, id, true);
    const second = h.host.getSnapshot().accepted; check(second.revision === first.revision + 1, 'Fresh imported-only reedit must accept once.'); equal(second.nativeDocument, first.nativeDocument); preserved(second, original); equal(h.model.camera, local); const secondFileText = serializeRenderNativeSceneDocument(second); h.close();
    return {scope, checks: ['Fresh emitted FILE-only reconstruction/Open/reset; original A/B from actual1484 numeric parent1050/1.1/.6 retained; imported-body2950/Scale1.2/amount.4 ONE reedit with current view, SECOND whole authored file.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText, addedBodyId: id};
  });
}

export function verifyNativeSurfaceAddFiles(referenceSource: string, firstText: string, secondText: string): NativeSurfaceAddFlowResult {
  const reads: string[] = []; return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = parent(referenceSource, {documentId: first.documentId, title: first.title}); preserved(first, original); preserved(second, original);
    check(first.nativeDocument.revision === 4 && first.nativeDocument.assets.length === 3 && first.surfaceMaterials.length === 3 && second.revision > first.revision, 'Genuine new inventory/native4/monotonicity mismatch.'); equal(second.nativeDocument, first.nativeDocument);
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText, 'Genuine complete codec bytes changed.'); const id = added(first); check(added(second) === id, 'Imported identity changed.');
    const body = first.nativeDocument.bodies.find(item => item.id === id)!, asset = first.nativeDocument.assets.find(item => item.id === body.assetId)!; check(body.geometryId === SURFACE && asset.source === referenceSource && asset.revision === 0, 'Whole original source/native Surface/newasset0 changed.');
    const one = first.surfaceMaterials.find(item => item.target.bodyId === id)!, two = second.surfaceMaterials.find(item => item.target.bodyId === id)!;
    equal(one.material.shaderSource, original.surfaceMaterials.find(item => item.target.bodyId === B)!.material.shaderSource); equal(two.material.shaderSource, one.material.shaderSource); check(one.material.uniforms.amount !== .6 && two.material.uniforms.amount !== one.material.uniforms.amount && two.material.revision > one.material.revision, 'Independent imported material reedit missing.');
    check(JSON.stringify(second.display.poses.find(item => item.bodyId === id)) !== JSON.stringify(first.display.poses.find(item => item.bodyId === id)), 'Imported-body transform reedit missing.');
    return {scope, checks: ['Supplied genuine files only: original A/B1050-scale1.1-.6 source/q/material/camera/light exact except real targetnative4; actual full322B import/newasset0/nativegeometry/newmaterial independent, monotonic imported reedit and real reconstruction. Graphics/filepicker remain separate GUI evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, addedBodyId: id};
  });
}
