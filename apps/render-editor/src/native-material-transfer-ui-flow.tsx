import {act, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {parseRenderMaterialDocument, serializeRenderMaterialDocument, RENDER_MATERIAL_LIMITS} from '@barocss/render-editor';
import type {RenderMaterialController, RenderMaterialDocument, RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';
import type {ViewerState} from '@barocss/viewer';
import {MaterialApp} from './material-app';
import type {MaterialPreviewBridge} from './material-preview';
import type {NativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

const scope = 'Actual MaterialApp, Radix menu, React controls, real sessions/controllers/Native host in CPU jsdom. Only preview presentation/transport, chooser and download transport are substituted. This does not certify browser focus, native picker, saved download persistence or GPU pixels.';
function check(value: unknown, message: string): asserts value {if (!value) throw Error(message);}
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs');
  const keys = Object.keys(a), other = Object.keys(b);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ');
  for (const key of keys) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
interface CpuTransport {
  bridge: MaterialPreviewBridge; host: NativeSceneHost | null; camera: MeshCamera; epoch: number; owner: object;
  presentations: number; transitions: number; publish: ((value: MaterialPreviewBridge | null) => void) | undefined;
}
let transport: CpuTransport | null = null;
/** Launcher substitutes only material-preview.tsx with this declared CPU presentation boundary. */
export function CpuMaterialTransferPreview({controller, nativeHost, onBridgeChange}: {
  controller: RenderMaterialController; nativeHost?: NativeSceneHost | null; onBridgeChange?(bridge: MaterialPreviewBridge | null): void;
}) {
  const current = transport; check(current, 'CPU transport missing'); current.host = nativeHost ?? null; current.publish = onBridgeChange;
  useEffect(() => {
    controller.setPresenter(() => {current.presentations++; current.owner = {};}); onBridgeChange?.(current.bridge);
    return () => {onBridgeChange?.(null);};
  }, [controller, current, onBridgeChange]);
  return <canvas data-testid="cpu-presentation-boundary" tabIndex={0}/>;
}
function makeTransport(source: string): CpuTransport {
  const current: CpuTransport = {bridge: null as unknown as MaterialPreviewBridge, host: null,
    camera: {eye: [0, 2, 4], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100},
    epoch: 0, owner: {}, presentations: 0, transitions: 0, publish: undefined};
  current.bridge = {source, context: {mmToSceneUnit: .001, background: [.025, .04, .06]},
    getState: () => ({status: 'ready', camera: current.camera, lighting: {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4]}} as ViewerState),
    getEpoch: () => current.epoch, getAppearanceToken: () => current.owner,
    pickNativeSurface: () => null, frameNativeBody: () => {},
    present(prepared: RenderNativeSceneAppearancePreparation, override?: MeshCamera) {
      const request = prepareNativeViewportAppearance(prepared, override); current.camera = structuredClone(request.display.camera);
      current.owner = {}; current.presentations++;
    },
    beginTransition: () => {current.transitions++;}, endTransition: () => {current.transitions--;}, retireLegacy: () => {current.epoch++;}};
  return current;
}
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {const element = document.querySelector<T>('[data-testid="' + id + '"]'); check(element, 'Missing ' + id); return element;};
async function click(id: string) {await act(async () => {byId(id).click(); await flush();});}
async function fileMenu() {
  await act(async () => {const trigger = byId('native-file-menu'); trigger.focus(); trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true})); await flush();});
  check(byId('native-file-menu').getAttribute('data-state') === 'open', 'Actual File menu did not open');
}
async function command(id: string) {await fileMenu(); await click(id);}
async function closeMenu() {await act(async () => {document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await flush();});}
function portable(target: RenderMaterialDocument): RenderMaterialDocument {
  return {...target, documentId: 'foreign_identity', title: 'Portable title', revision: 75,
    shaderSource: '// Exact portable source\r\n@shader #portable {\r\n @uniform imported: float(0, 1, .25);\r\n @uniform signed: float(-1, 1, 0);\r\n @uniform omitted: float(0, 1, .5);\r\n @fragment { color: mix(#ff0000, #0000ff, imported); }\r\n}\r\n', uniforms: {imported: .8, signed: -0}};
}
function file(bytes: Uint8Array, size = bytes.byteLength) {
  let reads = 0, resolve: ((value: ArrayBuffer) => void) | null = null;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const value = {name: 'same.material.json', size, arrayBuffer() {reads++; return new Promise<ArrayBuffer>(done => {resolve = done;});}} as File;
  return {value, get reads() {return reads;}, finish() {check(resolve, 'Read was not started'); resolve(buffer);}};
}
async function selectFile(value?: File) {
  await act(async () => {const input = byId<HTMLInputElement>('native-material-file-input'); Object.defineProperty(input, 'files', {configurable: true, value: value ? [value] : []}); input.dispatchEvent(new Event('change', {bubbles: true})); await flush();});
}
async function finishFile(value: ReturnType<typeof file>) {await act(async () => {value.finish(); await flush();});}

/** CPU launcher contract (no new dependency): initialize installed jsdom DOM globals before importing this module;
 * bundle this entry with actual MaterialApp/providers and shared external React/ReactDOM; substitute only the
 * app's ./material-preview import with CpuMaterialTransferPreview exported above. Supply the tracked
 * apps/render-editor/public/reference-panel.barocad text and record its SHA-256 and esbuild input graph.
 * DOM needs request/cancelAnimationFrame, inert ResizeObserver and pointer-capture/scrollIntoView shims.
 * File.arrayBuffer, chooser clicks and Blob URL/download clicks are controlled transport boundaries here.
 * This deliberately does not mount Viewer/GPU or claim native picker/download/browser-focus acceptance.
 */
export async function runNativeMaterialTransferUiFlow(referenceSource: string) {
  const downloads: Array<{name: string; blob: Blob}> = [], blobs = new Map<string, Blob>(), checks: string[] = [];
  const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL, anchorClick = HTMLAnchorElement.prototype.click, inputClick = HTMLInputElement.prototype.click;
  let chooserClicks = 0;
  URL.createObjectURL = blob => {check(blob instanceof Blob, 'Download must use Blob'); const url = 'blob:cpu-' + blobs.size; blobs.set(url, blob); return url;}; URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {const blob = blobs.get(this.href); check(blob, 'Download did not use captured Blob'); downloads.push({name: this.download, blob});};
  HTMLInputElement.prototype.click = function () {if (this.type === 'file') {chooserClicks++; return;} inputClick.call(this);};
  let root: ReturnType<typeof createRoot> | null = null, mount: HTMLDivElement | null = null;
  const setup = async () => {
    transport = makeTransport(referenceSource); mount = document.createElement('div'); document.body.append(mount); root = createRoot(mount);
    await act(async () => {root!.render(<MaterialApp/>); await flush();});
    await fileMenu(); check(!document.querySelector('[data-testid="native-material-import"]'), 'Portable transfer commands leaked into non-Native mode'); await closeMenu();
    await click('native-create-scene'); check(transport.host, 'Actual Create Scene did not produce Native host'); return transport;
  };
  const cleanup = async () => {if (root) await act(async () => {root!.unmount(); await flush();}); root = null; mount?.remove(); mount = null;};
  try {
    const live = await setup(), host = live.host!, baseline = host.getSnapshot(), acceptedMaterial = host.materialSession.getSnapshot().accepted;
    const exportedText = serializeRenderMaterialDocument(acceptedMaterial);
    await fileMenu(); check(byId('native-material-import').textContent === 'Import material to selected Surface…', 'Import label changed'); check(byId('native-material-export').textContent === 'Export selected material…', 'Export label changed'); await click('native-material-export');
    check(downloads.length === 1 && downloads[0]!.name === acceptedMaterial.documentId + '.material.json', 'Export filename is not embedded identity');
    check(await downloads[0]!.blob.text() === exportedText && host.getSnapshot() === baseline, 'Export changed snapshot/saved state or bytes');
    check(document.activeElement === byId('native-file-menu'), 'Export did not return CPU DOM focus to File');
    await click('material-save'); const filename = byId('material-filename').textContent, afterSave = host.getSnapshot();
    await command('native-material-export'); check(byId('material-filename').textContent === filename && host.getSnapshot() === afterSave, 'Selected export changed scene filename or marked saved');
    checks.push('Native-only actual File menu labels; accepted-only export exact bytes/embedded filename without markSaved or scene filename changes');

    const unchanged = file(new TextEncoder().encode(serializeRenderMaterialDocument({...acceptedMaterial, documentId: 'ignored', title: 'Ignored title', revision: 123})));
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = host.getSnapshot(); await command('native-material-import'); await selectFile(unchanged.value); await finishFile(unchanged);
      check(host.getSnapshot() === before && byId<HTMLInputElement>('native-material-file-input').value === '', 'No-op or same-file selection mutated authority/input');
    }
    check(unchanged.reads === 2, 'Same File could not be selected twice');
    await command('native-material-import'); const cancelBefore = host.getSnapshot();
    await act(async () => {byId('native-material-file-input').dispatchEvent(new Event('cancel')); await flush();});
    check(host.getSnapshot() === cancelBefore && document.activeElement === byId('native-file-menu'), 'Chooser cancel altered authority or failed CPU focus return');
    await command('native-material-import'); await selectFile(); check(host.getSnapshot() === cancelBefore, 'Empty selection changed scene');
    checks.push('Chooser cancel/empty selection and exact no-op import retain snapshots; cleared input supports same-file reselection');

    live.camera = structuredClone(live.camera); live.camera.eye[0] += .2;
    await act(async () => {host.observeView(live.camera); await flush();});
    const beforeImport = host.getSnapshot(), beforeCalls = live.presentations, view = structuredClone(live.camera), imported = portable(acceptedMaterial);
    const changed = file(new TextEncoder().encode(serializeRenderMaterialDocument(imported)));
    await command('native-material-import'); await selectFile(changed.value); check(changed.reads === 1, 'Actual change event did not start read');
    await fileMenu(); check(byId('native-material-import').hasAttribute('data-disabled') && byId('native-material-export').hasAttribute('data-disabled'), 'Busy file commands enabled'); await closeMenu();
    const ignored = file(new TextEncoder().encode(exportedText)); await selectFile(ignored.value); check(ignored.reads === 0, 'Overlapping selection started a second read');
    await finishFile(changed);
    check(host.getSnapshot().accepted === beforeImport.accepted && live.presentations === beforeCalls && host.getSnapshot().dirty, 'Import applied or presented prematurely');
    check(host.materialSession.getSnapshot().draftSource === imported.shaderSource && Object.is(host.materialSession.getSnapshot().draftUniforms.signed, -0), 'Actual input lost paired source/-0');
    check(!Object.hasOwn(host.materialSession.getSnapshot().draftUniforms, 'omitted'), 'Actual input filled omitted defaults'); equal(host.getSnapshot().viewCamera, beforeImport.viewCamera);
    await fileMenu(); check(byId('native-material-import').hasAttribute('data-disabled') && byId('native-material-export').hasAttribute('data-disabled') && /Apply or Discard/.test(byId('native-material-import').title), 'Dirty transfer controls need refusal explanation'); await closeMenu();
    await click('native-material-preview'); check(host.getSnapshot().materialPreview && host.getSnapshot().accepted === beforeImport.accepted, 'Actual Preview authored import');
    await fileMenu(); check(byId('native-material-import').hasAttribute('data-disabled'), 'Preview transfer enabled'); await closeMenu();
    await click('native-material-preview-cancel'); check(host.getSnapshot().dirty && host.materialSession.getSnapshot().draftSource === imported.shaderSource, 'Actual Cancel lost import');
    await click('native-material-preview'); await click('native-material-preview-apply');
    check(host.getSnapshot().accepted.revision === beforeImport.accepted.revision + 1 && host.materialSession.getSnapshot().accepted.revision === acceptedMaterial.revision + 1, 'Actual Apply did not accept one material/scene revision');
    equal(live.camera, view); equal(host.getSnapshot().accepted.display.camera, beforeImport.accepted.display.camera);
    await click('material-undo'); equal(host.getSnapshot().accepted.surfaceMaterials, beforeImport.accepted.surfaceMaterials, 'Actual Undo');
    await click('material-redo'); check(host.materialSession.getSnapshot().accepted.shaderSource === imported.shaderSource, 'Actual Redo');
    const exportState = host.getSnapshot(); await command('native-material-export');
    const importedExport = parseRenderMaterialDocument(await downloads[downloads.length - 1]!.blob.text());
    equal(importedExport, host.materialSession.getSnapshot().accepted, 'Imported accepted export roundtrip');
    check(host.getSnapshot() === exportState && Object.is(importedExport.uniforms.signed, -0) && !Object.hasOwn(importedExport.uniforms, 'omitted'), 'Imported export changed authority or supplied values');
    checks.push('Deferred read/overlap busy guards; paired source+overrides stage only; actual Preview/Cancel/Apply/Undo/Redo and both camera authorities');
    await cleanup();

    for (const kind of ['file-size', 'buffer-size', 'fatal-utf8', 'malformed', 'unsupported', 'invalid-source', 'unknown-override'] as const) {
      const current = await setup(), scene = current.host!, before = scene.getSnapshot(), material = scene.materialSession.getSnapshot().accepted;
      let bytes = new TextEncoder().encode(serializeRenderMaterialDocument(portable(material))), declaredSize = bytes.length;
      if (kind === 'file-size') declaredSize = RENDER_MATERIAL_LIMITS.fileBytes + 1;
      if (kind === 'buffer-size') {bytes = new Uint8Array(RENDER_MATERIAL_LIMITS.fileBytes + 1); declaredSize = 1;}
      if (kind === 'fatal-utf8') bytes = new Uint8Array([0xc3, 0x28]);
      if (kind === 'malformed') bytes = new TextEncoder().encode('{broken');
      if (kind === 'unsupported') bytes = new TextEncoder().encode(JSON.stringify({...portable(material), profile: 'future'}));
      if (kind === 'invalid-source') bytes = new TextEncoder().encode(JSON.stringify({...portable(material), shaderSource: '@shader broken'}));
      if (kind === 'unknown-override') bytes = new TextEncoder().encode(JSON.stringify({...portable(material), uniforms: {unknown: 1}}));
      const bad = file(bytes, declaredSize); await command('native-material-import'); await selectFile(bad.value);
      if (kind === 'file-size') check(bad.reads === 0, 'Oversize metadata started read'); else await finishFile(bad);
      check(scene.getSnapshot() === before && !scene.getSnapshot().dirty && current.transitions === 0, kind + ' mutated authority or retained transition');
      check(/DOCUMENT_|SOURCE_|UTF|encoded data/i.test(byId('material-app-status').textContent ?? ''), kind + ' refusal missing status');
      check(document.activeElement === byId('native-file-menu'), kind + ' refusal lost CPU File focus'); await cleanup();
    }
    checks.push('File.size and returned byteLength independently bounded; fatal UTF-8/malformed/version/source/override refusal before stage');

    for (const phase of ['before-selection', 'during-read'] as const) for (const kind of ['away-back', 'draft-discard', 'history', 'bridge-epoch', 'bridge-replacement', 'context-loss', 'dispose', 'unmount'] as const) {
      const current = await setup(), scene = current.host!, captured = scene.getSnapshot();
      const pending = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(scene.materialSession.getSnapshot().accepted))));
      await command('native-material-import'); if (phase === 'during-read') await selectFile(pending.value);
      await act(async () => {
        if (kind === 'away-back') {scene.selectTarget(captured.targets[1]!.bodyId); scene.selectTarget(captured.selectedBodyId);}
        if (kind === 'draft-discard') {scene.materialSession.setDraftSource(scene.materialSession.getSnapshot().draftSource + '\n'); scene.discardDraft();}
        if (kind === 'history') {const candidate = scene.prepareUndo(); check(candidate, 'Create Scene history missing'); scene.commitPrepared(candidate);}
        if (kind === 'bridge-epoch') current.epoch++;
        if (kind === 'bridge-replacement') current.publish?.({...current.bridge});
        if (kind === 'context-loss') scene.setAvailable(false);
        if (kind === 'dispose') scene.dispose();
        await flush();
      });
      if (kind === 'unmount') await cleanup();
      const afterChange = scene.getSnapshot(), raw = scene.materialSession.getSnapshot(), calls = current.presentations;
      if (phase === 'before-selection') {
        if (kind !== 'unmount') {await selectFile(pending.value); check(pending.reads === 0, kind + ' stale chooser began reading');}
      } else await finishFile(pending);
      check(scene.getSnapshot() === afterChange && scene.materialSession.getSnapshot().draftSource === raw.draftSource && current.presentations === calls, phase + '/' + kind + ' stale read changed live state');
      check(current.transitions === 0, phase + '/' + kind + ' retained held navigation'); await cleanup();
    }
    checks.push('Captured exact target survives no recapture: away-and-back, draft/history changes, bridge replacement/epoch, context loss/disposal and unmount before selection and during deferred read');

    for (const operation of ['export', 'open', 'save'] as const) {
      const current = await setup(), scene = current.host!; await command('native-material-import');
      if (operation === 'export') await command('native-material-export');
      else await click(operation === 'open' ? 'material-open' : 'material-save');
      const state = scene.getSnapshot(), pending = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(scene.materialSession.getSnapshot().accepted))));
      await selectFile(pending.value); check(pending.reads === 0 && scene.getSnapshot() === state, operation + ' did not invalidate earlier material chooser'); await cleanup();
    }
    checks.push('A newer whole-scene Open/Save or selected Export invalidates the earlier material chooser before bytes are read');

    for (const kind of ['pose', 'pole', 'unavailable'] as const) {
      const current = await setup(), scene = current.host!;
      await act(async () => {
        if (kind === 'pose') scene.beginBodyPosePreview(scene.getSnapshot().selectedBodyId);
        if (kind === 'pole') scene.beginSurfacePoleDrag(scene.getSnapshot().selectedBodyId, 0, 0);
        if (kind === 'unavailable') scene.setAvailable(false);
        await flush();
      });
      await fileMenu(); check(byId('native-material-import').hasAttribute('data-disabled') && byId('native-material-export').hasAttribute('data-disabled'), kind + ' actual menu commands enabled');
      await closeMenu(); await cleanup();
    }
    checks.push('Actual File commands disabled for body/pole gestures and unavailable presentation');

    for (const dialog of ['help', 'add-surface'] as const) {
      const current = await setup(), scene = current.host!; await command('native-material-import');
      await click(dialog === 'help' ? 'material-help' : 'native-add-surface');
      check(document.querySelector('[role="dialog"]'), dialog + ' actual dialog missing');
      const active: Element | null = document.activeElement;
      const state = scene.getSnapshot(), pending = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(scene.materialSession.getSnapshot().accepted))));
      await selectFile(pending.value); check(pending.reads === 0 && scene.getSnapshot() === state, dialog + ' did not block earlier chooser');
      check(document.activeElement === active, dialog + ' refusal stole dialog focus'); await cleanup();
    }
    checks.push('Actual Help and Add Surface dialogs invalidate a pending chooser without stealing the newer dialog focus');

    const addCanceled = await setup(), addHost = addCanceled.host!, addBefore = addHost.getSnapshot();
    await command('native-material-import'); await click('native-add-surface'); await click('native-add-choose-file'); await click('native-add-cancel');
    check(!document.querySelector('[data-testid="native-add-dialog"]') && document.activeElement === byId('native-add-surface'), 'Add cancellation did not close and return CPU focus');
    const obsolete = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(addHost.materialSession.getSnapshot().accepted))));
    await selectFile(obsolete.value);
    check(obsolete.reads === 0 && addHost.getSnapshot() === addBefore && document.activeElement === byId('native-add-surface'), 'Canceled newer CAD chooser revived the earlier material chooser or stole focus');
    await cleanup(); checks.push('Opening and canceling the newer CAD source chooser permanently invalidates the older material chooser without scene changes');

    const replaced = await setup(), old = replaced.host!; await command('native-material-import');
    await fileMenu(); const newItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(element => element.textContent?.startsWith('New')); check(newItem, 'Actual New command missing');
    await act(async () => {newItem.click(); await flush();}); check(replaced.host !== old && old.getSnapshot().disposed, 'Actual New did not replace host');
    const late = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(replaced.host!.materialSession.getSnapshot().accepted))));
    const replacedSnapshot = replaced.host!.getSnapshot(); await selectFile(late.value);
    check(late.reads === 0 && replaced.host!.getSnapshot() === replacedSnapshot, 'Old chooser targeted replacement host'); await cleanup();

    const focused = await setup(), focusedHost = focused.host!; await command('native-material-import');
    const focusFile = file(new TextEncoder().encode(serializeRenderMaterialDocument(portable(focusedHost.materialSession.getSnapshot().accepted)))); await selectFile(focusFile.value);
    const intentional = document.createElement('button'); intentional.textContent = 'New intentional focus'; document.body.append(intentional); await act(async () => {intentional.focus(); await flush();});
    await finishFile(focusFile); check(document.activeElement === intentional, 'Read completion stole newer intentional CPU focus'); intentional.remove();
    await click('material-discard'); check(!focusedHost.getSnapshot().dirty, 'Actual Discard failed');
    checks.push('Actual New host replacement invalidates chooser; completion preserves newer intentional CPU DOM focus; actual Discard clears imported draft');
    await cleanup();
    return {scope, checks, chooserClicks, downloads: downloads.length};
  } finally {
    await cleanup(); transport = null; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl;
    HTMLAnchorElement.prototype.click = anchorClick; HTMLInputElement.prototype.click = inputClick;
  }
}
