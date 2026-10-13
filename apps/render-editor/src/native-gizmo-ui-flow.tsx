import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {deriveRenderNativeSceneGizmoPose, prepareRenderNativeSceneGizmo, hitTestRenderSceneGizmo,
  validateRenderNativeSceneDocument, serializeRenderNativeSceneDocument} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePose, RenderSceneGizmoViewport} from '@barocss/render-editor';
import {prepareCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {NativeSceneGizmo} from './native-scene-gizmo';
import {createNativeSceneHost} from './native-scene-host';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';

type Point = readonly [number, number];
export interface NativeGizmoUiControls {
  flushFrames(): void;
  resize(): void;
  pendingFrames(): number;
  captures(): number;
  observers(): number;
}
const BODY = 'body_preview_b', OTHER = 'body_preview_a';
const viewport: RenderSceneGizmoViewport = {width: 900, height: 600, backingWidth: 1800, backingHeight: 1200};
const camera: MeshCamera = {eye: [5, 4, 7], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const,
  documentId: 'gizmo-event-material', title: 'Gizmo event material', revision: 0,
  shaderSource: '@shader #event_material { @fragment { color: #ff0000; } }\n', uniforms: {}};
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function equal(a: unknown, b: unknown, label: string): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs');
  const keys = Object.keys(a), other = Object.keys(b);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ');
  for (const key of keys) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function pose(document: RenderNativeSceneDocument, body: string): RenderNativeScenePose {
  const value = document.display.poses.find(value => value.bodyId === body); check(value, 'Missing explicit body pose'); return value;
}
function refuses(operation: () => unknown) {let refused = false; try {operation();} catch {refused = true;} check(refused, 'Expected refusal');}

/** Actual component listeners/host/providers. The launcher owns declared DOM/presentation boundaries. */
export async function runNativeGizmoUiFlow(source: string, controls: NativeGizmoUiControls) {
  const seed = createNativeSceneSeed(createNativeSceneBase(source, material, camera,
    {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4]}));
  const documentSeed = validateRenderNativeSceneDocument({...seed, display: {...seed.display, camera}});
  const checks: string[] = [], attempts: Array<Record<string, unknown>> = [], cleanupErrors: string[] = [];
  // Independent actual-camera projection witnesses an axis that used to be drawn
  // wholly inside the 13.5 CSS-pixel pivot exclusion (and could never be hit).
  const nativeOrigin = pose(documentSeed, BODY).translationMM.map(value => value * documentSeed.display.mmToSceneUnit);
  const nearZCamera: MeshCamera = {...camera, target: [nativeOrigin[0]!, nativeOrigin[1]!, nativeOrigin[2]!],
    eye: [nativeOrigin[0]! + .25, nativeOrigin[1]!, nativeOrigin[2]! + 5]};
  const matrices = prepareCamera(nearZCamera, viewport.backingWidth / viewport.backingHeight);
  const cameraProject = (point: readonly number[]): Point => {
    const vector = [...point, 1];
    const view = [0, 1, 2, 3].map(row => [0, 1, 2, 3].reduce((sum, col) =>
      sum + matrices.view[col * 4 + row]! * vector[col]!, 0));
    const clip = [0, 1, 2, 3].map(row => [0, 1, 2, 3].reduce((sum, col) =>
      sum + matrices.projection[col * 4 + row]! * view[col]!, 0));
    return [(1 + clip[0]! / clip[3]!) * viewport.width / 2, (1 - clip[1]! / clip[3]!) * viewport.height / 2];
  };
  const depth = -[0, 1, 2].reduce((sum, col) => sum + matrices.view[col * 4 + 2]! * nativeOrigin[col]!, matrices.view[14]!);
  const radius = 160 * depth / (matrices.projection[5]! * viewport.height);
  const center = cameraProject(nativeOrigin);
  const zTip = cameraProject([nativeOrigin[0]!, nativeOrigin[1]!, nativeOrigin[2]! + radius]);
  const nearZProjectedCSS = Math.hypot(zTip[0] - center[0], zTip[1] - center[1]);
  check(nearZProjectedCSS > 4 && nearZProjectedCSS < 13.5,
    'Fixture no longer witnesses a historically visible but unpickable Z axis');
  const nearZ = prepareRenderNativeSceneGizmo(documentSeed, BODY, nearZCamera, viewport, 'translate', 'world', 'origin');
  check(!nearZ.handles.some(handle => handle.key === 'z'), 'Unpickable near-view-aligned Z arrow is still shown');
  for (const axis of ['x', 'y'] as const) {
    const handle = nearZ.handles.find(handle => handle.key === axis);
    check(handle && hitTestRenderSceneGizmo(nearZ, handle.anchor) === handle,
      'Unrelated projected ' + axis.toUpperCase() + ' arrow was lost');
  }

  const cleanupAfterFailure = async (cause: unknown, cleanup: () => Promise<void>): Promise<never> => {
    try {await cleanup();} catch (error) {cleanupErrors.push(String(error), ...(error instanceof AggregateError ? error.errors.map(String) : []));}
    if (cause instanceof Error) Object.defineProperty(cause, 'gizmoCleanupErrors', {value: [...cleanupErrors], configurable: true});
    throw cause;
  };
  let disposedHosts = 0, unmountedRoots = 0, totalPresentations = 0, pointerAttempts = 0;
  const setup = async (name: string, body = BODY, view = camera) => {
    check(attempts.length < 10, 'The ten-attempt budget was exceeded');
    const original = validateRenderNativeSceneDocument({...documentSeed, display: {...documentSeed.display, camera: view}});
    const host = createNativeSceneHost(original), surface = document.createElement('div'), canvas = document.createElement('canvas'), mount = document.createElement('div');
    surface.append(canvas, mount); document.body.append(surface); canvas.tabIndex = 0;
    canvas.width = viewport.backingWidth; canvas.height = viewport.backingHeight;
    const rect = {left: 137, top: 83, width: viewport.width, height: viewport.height};
    canvas.getBoundingClientRect = () => ({...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, toJSON: () => ({...rect})});
    let owner: object = {}, shown = original, presentations = 0, navigationEvents = 0, refusePresentation = false;
    const errors: string[] = [];
    let root: ReturnType<typeof createRoot> | null = null, cleaned = false;
    const competing = () => {navigationEvents++;};
    const releaseResources = async () => {
      if (cleaned) return; cleaned = true;
      const failures: unknown[] = [];
      try {if (root) {await act(async () => {root!.unmount();}); unmountedRoots++;}} catch (error) {failures.push(error);}
      try {host.dispose(); disposedHosts++;} catch (error) {failures.push(error);}
      finally {canvas.removeEventListener('pointerdown', competing); canvas.removeEventListener('pointermove', competing); canvas.removeEventListener('pointerup', competing); surface.remove();}
      if (failures.length) throw new AggregateError(failures, 'Native gizmo fixture cleanup failed');
    };
    try {
    host.setPresenter(prepared => {presentations++; totalPresentations++; if (refusePresentation) {refusePresentation = false; throw new Error('Controlled restore refusal');} shown = prepared.authored.document; owner = {};}, () => owner);
    host.selectTarget(body);
    root = createRoot(mount);
    canvas.addEventListener('pointerdown', competing); canvas.addEventListener('pointermove', competing); canvas.addEventListener('pointerup', competing);
    await act(async () => {root!.render(<NativeSceneGizmo host={host} canvas={canvas} disabled={false} onError={error => errors.push(error instanceof Error ? error.message : String(error))} onFrame={() => {throw new Error('Unexpected frame');}} onFrameAll={() => {throw new Error('Unexpected frame all');}}/>);});
    const overlay = mount.querySelector<SVGSVGElement>('[data-testid="gizmo-overlay"]'); check(overlay, 'Missing actual shared GizmoSurface');
    const record: Record<string, unknown> = {name, body, mode: 'translate', space: 'world', pivot: 'bounds-center', camera: view, viewport, cssRect: {...rect}};
    attempts.push(record);
    const pointer = async (type: string, point: Point, target: Element = canvas, buttons = type === 'pointerup' ? 0 : 1) => {
      if (type === 'pointerdown') {pointerAttempts++; check(pointerAttempts <= 10, 'Pointer acquisition budget exceeded');}
      await act(async () => {const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, buttons, clientX: point[0] + rect.left, clientY: point[1] + rect.top}); Object.defineProperty(event, 'pointerId', {value: 7}); target.dispatchEvent(event);});
    };
    const frames = async () => {await act(async () => {controls.flushFrames();});};
    const prep = () => prepareRenderNativeSceneGizmo(host.getSnapshot().accepted, body, view, viewport, 'translate', 'world', 'bounds-center');
    const acquire = async () => {
      const prepared = prep(), handle = prepared.handles.find(handle => handle.key === 'x'); check(handle, 'Expected visible X handle');
      check(hitTestRenderSceneGizmo(prepared, handle.anchor)?.key === 'x', 'Fixture X anchor is not uniquely picked');
      const from = handle.anchor, delta: Point = [handle.anchor[0] - prepared.pivot[0], handle.anchor[1] - prepared.pivot[1]], length = Math.hypot(...delta);
      check(length > 10, 'Fixture has degenerate projected X');
      const to: Point = [from[0] + delta[0] / length * 18, from[1] + delta[1] / length * 18];
      const rendered = mount.querySelector<SVGGElement>('[data-gizmo-key="x"]'); check(rendered, 'Actual X glyph absent');
      check(Number(rendered.dataset.anchorX) === from[0] && Number(rendered.dataset.anchorY) === from[1], 'Rendered and picked X coordinates differ');
      record.axis = 'x'; record.from = from; record.to = to;
      await pointer('pointermove', from, canvas, 0);
      check(overlay.dataset.hoveredAxis === 'x', 'Actual hover did not choose X');
      const beforeNavigation = navigationEvents;
      await pointer('pointerdown', from);
      check(host.getSnapshot().poseGestureActive && overlay.dataset.activeAxis === 'x', 'Actual X acquisition failed');
      check(overlay.hasPointerCapture(7), 'Pointer capture was not acquired');
      check(document.activeElement === canvas, 'Canvas did not receive transform focus');
      check(navigationEvents === beforeNavigation, 'Picked down reached navigation competitor');
      return {from, to, beforeNavigation};
    };
    const unchanged = () => {
      equal(host.getSnapshot().accepted, original, name + ' accepted');
      check(!host.getSnapshot().canUndo && !host.getSnapshot().canRedo, name + ' changed history');
    };
    const released = () => {check(!host.getSnapshot().poseGestureActive && !host.getSnapshot().posePreview, name + ' left pending pose'); check(!overlay.hasPointerCapture(7) && controls.pendingFrames() === 0, name + ' leaked capture/frame');};
    const cleanup = async () => {
      await releaseResources();
      check(controls.pendingFrames() === 0 && controls.captures() === 0 && controls.observers() === 0, 'Controlled resources survived unmount');
      record.presentations = presentations; record.errors = errors; record.complete = true;
    };
    return {host, original, canvas, overlay, mount, rect, view, body, record, pointer, frames, acquire, unchanged, released, cleanup,
      get shown() {return shown;}, get navigationEvents() {return navigationEvents;}, refuseNextPresentation() {refusePresentation = true;}};
    } catch (cause) {return cleanupAfterFailure(cause, releaseResources);}
  };
  const scenario = async (name: string, action: (value: Awaited<ReturnType<typeof setup>>) => Promise<void>, body = BODY, view = camera) => {
    const value = await setup(name, body, view);
    try {await action(value);} catch (cause) {return cleanupAfterFailure(cause, value.cleanup);}
    await value.cleanup(); checks.push(name);
  };
  await scenario('offset CSS picking and one release commit', async h => {
    const {from, to, beforeNavigation} = await h.acquire();
    await h.pointer('pointermove', to); await h.frames();
    h.unchanged(); check(h.host.getSnapshot().posePreview, 'Move did not preview');
    await h.pointer('pointerup', to, h.overlay); h.released();
    const accepted = h.host.getSnapshot().accepted, expected = deriveRenderNativeSceneGizmoPose(h.original, h.body, h.view, viewport, 'translate', 'world', 'x', from, to, 'bounds-center');
    equal(pose(accepted, h.body), expected, 'Actual release/derivation');
    const before = pose(h.original, h.body), after = pose(accepted, h.body);
    check(after.translationMM[0] > before.translationMM[0], 'Positive projected X drag did not increase authored X');
    equal(after.translationMM.slice(1), before.translationMM.slice(1), 'Unchanged Y/Z');
    equal(accepted, {...h.original, revision: h.original.revision + 1, display: {...h.original.display, poses: h.original.display.poses.map(value => value.bodyId === h.body ? expected : value)}}, 'Whole accepted authority');
    equal(h.shown, accepted, 'Presented release'); check(h.navigationEvents === beforeNavigation, 'Transform movement reached navigation competitor');
    await act(async () => {const undo = h.host.prepareUndo(); check(undo, 'Missing one history entry'); h.host.commitPrepared(undo);});
    check(!h.host.getSnapshot().canUndo && h.host.getSnapshot().canRedo, 'Release created more than one history entry');
    equal(h.host.getSnapshot().accepted.display, h.original.display, 'Undo display');
    await act(async () => {const redo = h.host.prepareRedo(); check(redo, 'Missing redo'); h.host.commitPrepared(redo);});
    equal(pose(h.host.getSnapshot().accepted, h.body), expected, 'Redo pose');
  });
  await scenario('no-op release creates no history', async h => {const {from} = await h.acquire(); await h.pointer('pointerup', from, h.overlay); h.unchanged(); h.released();});
  for (const type of ['Escape', 'pointercancel', 'lostpointercapture', 'blur'] as const) {
    await scenario(type + ' restores the accepted pose', async h => {
      const {to} = await h.acquire(); await h.pointer('pointermove', to, h.overlay); await h.frames(); check(h.host.getSnapshot().posePreview, 'Cancellation requires a real preview');
      if (type === 'Escape') await act(async () => {h.canvas.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));});
      else if (type === 'blur') await act(async () => {window.dispatchEvent(new Event('blur'));});
      else await h.pointer(type, to, h.overlay);
      h.unchanged(); h.released(); equal(h.shown, h.original, 'Restored presentation');
      await h.pointer('pointerup', to, h.overlay); h.unchanged();
    });
  }
  await scenario('resize cancels without a late commit', async h => {
    const {to} = await h.acquire(); await h.pointer('pointermove', to, h.overlay); await h.frames();
    await act(async () => {h.rect.width += 30; controls.resize();}); h.unchanged(); h.released(); equal(h.shown, h.original, 'Resize restoration');
    await h.pointer('pointerup', to, h.overlay); h.unchanged();
  });
  await scenario('selection guard and stale availability fence queued motion', async h => {
    const {to} = await h.acquire(); await act(async () => {refuses(() => h.host.selectTarget(BODY));});
    check(h.host.getSnapshot().selectedBodyId === OTHER, 'Active selection guard changed target');
    await h.pointer('pointermove', to, h.overlay); check(controls.pendingFrames() === 1, 'Expected one queued frame');
    await act(async () => {h.host.setAvailable(false);}); await h.frames();
    h.unchanged(); h.released(); await h.pointer('pointerup', to, h.overlay); h.unchanged();
  }, OTHER);
  await scenario('near-parallel Z is absent and refuses instead of falling back', async h => {
    const prepared = prepareRenderNativeSceneGizmo(h.original, BODY, h.view, viewport, 'translate', 'world', 'bounds-center');
    check(!prepared.handles.some(handle => handle.key === 'z') && !h.mount.querySelector('[data-gizmo-key="z"]'), 'View-parallel Z remained editable');
    check(prepared.handles.some(handle => handle.key === 'x') && prepared.handles.some(handle => handle.key === 'y'), 'Parallel fixture lost unrelated axes');
    check(hitTestRenderSceneGizmo(prepared, prepared.pivot) === null, 'Unavailable-axis projection picks a different axis');
    h.record.axis = 'z (unavailable)'; h.record.from = prepared.pivot;
    await h.pointer('pointerdown', prepared.pivot); await h.pointer('pointerup', prepared.pivot); h.unchanged(); h.released();
    refuses(() => deriveRenderNativeSceneGizmoPose(h.original, BODY, h.view, viewport, 'translate', 'world', 'z', prepared.pivot, [prepared.pivot[0] + 12, prepared.pivot[1]], 'bounds-center'));
  }, BODY, {...camera, eye: [.9 + 1e-9, -.55, 5], target: [.9, -.55, 0]});
  await scenario('refused cancellation retains a recoverable preview', async h => {
    const {to} = await h.acquire(); await h.pointer('pointermove', to, h.overlay); await h.frames(); h.refuseNextPresentation();
    await act(async () => {h.canvas.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));});
    h.unchanged(); check(h.host.getSnapshot().posePreview, 'Refused restoration hid pending preview');
    const cancel = [...h.mount.querySelectorAll('button')].find(button => button.textContent === 'Cancel transform'); check(cancel && !cancel.disabled, 'Recovery action unavailable');
    await act(async () => {cancel.click();}); h.unchanged(); h.released(); equal(h.shown, h.original, 'Retry restoration');
  });
  check(pointerAttempts === 10 && attempts.length === 10 && checks.length === 10 && disposedHosts === 10 && unmountedRoots === 10, 'Incomplete finite flow');
  return {scope: 'Actual Native React/shared GizmoSurface and real NativeSceneHost CPU event flow; controlled DOM geometry, capture, RAF, ResizeObserver and presentation. No GPU/browser/physical-file acceptance.',
    nearZProjectedCSS, nearZCamera, checks, attempts, cleanupErrors, pointerAttempts, disposedHosts, unmountedRoots, totalPresentations, sourceRetained: documentSeed.nativeDocument.assets.every(asset => asset.source === source), canonicalSeed: serializeRenderNativeSceneDocument(documentSeed),
    pendingFrames: controls.pendingFrames(), captures: controls.captures(), observers: controls.observers()};
}
