import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {prepareRenderNativeLightDocument} from '@barocss/render-editor';
import type {RenderNativeLightDocument} from '@barocss/render-editor';
import {createCadGeometryReference, queryCadDocumentBounds, validateCadDocumentBounds} from '@barocss/cad';
import {prepareCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {prepareSceneTransform, sceneRotation} from '../../../packages/barocss-gpu/src/mesh-scene-transform';
import {NativeLightWorkbench} from './native-light-workbench';
export {deriveLightBodyCommand, deriveLightSurfaceAddition, deriveLightSurfacePointEdit, readLightSurfacePoints, lightBodyReservedIds} from './native-light-bodies';

/** Real React UI with a privately controlled Viewer in the runner. This does not prove GPU pixels. */
export async function mountLightWorkbenchFlow(container: HTMLElement, initial?: RenderNativeLightDocument) {
  const root = createRoot(container);
  try {await act(async () => {root.render(<NativeLightWorkbench initialDocument={initial}/>);});}
  catch (cause) {
    try {await act(async () => {root.unmount();});} catch (cleanup) {console.error('Light flow setup cleanup failed:', cleanup);}
    throw cause;
  }
  return {async dispose() {await act(async () => {root.unmount();});}};
}

/** Visible raw fields only: no React internals or alternate authoring state. */
export function readLightWorkbenchFlowDraft(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[aria-label]:not([type="file"])')]
    .map(input => ({label: input.getAttribute('aria-label'), value: input.value,
      ...(input.type === 'checkbox' ? {checked: input.checked} : {})}));
}

/** Independent test oracle: original CAD bounds and GPU pose/camera services, never fitter output corners. */
export function inspectLightFramingFlow(document: RenderNativeLightDocument, camera: MeshCamera,
  bodyIds: readonly string[], backing: {backingWidth: number; backingHeight: number}) {
  const prepared = prepareRenderNativeLightDocument(document);
  const matrices = prepareCamera(camera, backing.backingWidth / backing.backingHeight);
  // Deliberately multiply the actual prepared Float32 matrices here instead of reusing
  // the fitting helper's projection check or its camera-space distance calculation.
  const multiply = (matrix: Float32Array, point: readonly number[]) => [0, 1, 2, 3].map(row => {
    let value = Math.fround(matrix[row] * Math.fround(point[0]));
    for (let column = 1; column < 4; column++) value = Math.fround(value + Math.fround(matrix[column * 4 + row] * Math.fround(point[column])));
    return value;
  });
  return bodyIds.map(bodyId => {
    const entry = prepared.entries.find(item => item.binding.bodyId === bodyId);
    if (!entry) throw new Error('Missing original framing-test body ' + bodyId);
    const reference = createCadGeometryReference(prepared.native, {bodyId}).reference;
    const bounds = queryCadDocumentBounds(prepared.native, reference);
    const report = validateCadDocumentBounds(prepared.native, bounds);
    const authored = prepared.document.display.poses.find(pose => pose.bodyId === bodyId);
    const pose = prepareSceneTransform(authored ? {translationMm: [...authored.translationMM],
      rotationXYZW: [...authored.rotationXYZW], scale: [...authored.scale]}
      : {translationMm: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]});
    const rotate = sceneRotation(pose);
    const corners = Array.from({length: 8}, (_, bits) => {
      const original = [0, 1, 2].map(axis => bits & (1 << axis) ? bounds.boundsMM.max[axis] : bounds.boundsMM.min[axis]);
      const rotated = rotate(original[0] * pose.scale[0], original[1] * pose.scale[1], original[2] * pose.scale[2]);
      const worldScene = rotated.map((value, axis) => (value + pose.translationMm[axis]) * document.display.mmToSceneUnit);
      const view = multiply(matrices.view, [...worldScene, 1]);
      const clip = multiply(matrices.projection, view);
      return {original, worldScene, depth: -view[2], clip, ndc: clip.slice(0, 3).map(value => value / clip[3])};
    });
    return {bodyId, reference, binding: entry.binding, boundsMM: bounds.boundsMM, report, corners};
  });
}

/** Controlled DOM boundary only; real input listeners, camera derivation and session remain in use. */
export function installLightNavigationFlowDom() {
  const saved: {target: object; key: PropertyKey; descriptor: PropertyDescriptor | undefined}[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  const captures = new Map<HTMLCanvasElement, Set<number>>();
  let rectangle = {left: 40, top: 25, width: 900, height: 600};
  let nextFrame = 1, disposed = false;
  const patch = (target: object, key: PropertyKey, value: unknown) => {
    saved.push({target, key, descriptor: Object.getOwnPropertyDescriptor(target, key)});
    Object.defineProperty(target, key, {value, writable: true, configurable: true});
  };
  const restore = () => {
    for (const {target, key, descriptor} of saved.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  };
  try {
    patch(globalThis, 'requestAnimationFrame', (callback: FrameRequestCallback) => {const id = nextFrame++; frames.set(id, callback); return id;});
    patch(globalThis, 'cancelAnimationFrame', (id: number) => {frames.delete(id);});
    patch(HTMLCanvasElement.prototype, 'getBoundingClientRect', () => {
      const rect = {...rectangle};
      return {...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, toJSON() {return {...rect};}};
    });
    patch(HTMLCanvasElement.prototype, 'setPointerCapture', function(this: HTMLCanvasElement, id: number) {
      const ids = captures.get(this) ?? new Set<number>(); ids.add(id); captures.set(this, ids);
    });
    patch(HTMLCanvasElement.prototype, 'hasPointerCapture', function(this: HTMLCanvasElement, id: number) {return captures.get(this)?.has(id) ?? false;});
    patch(HTMLCanvasElement.prototype, 'releasePointerCapture', function(this: HTMLCanvasElement, id: number) {
      const ids = captures.get(this); if (!ids?.delete(id)) return;
      if (!ids.size) captures.delete(this);
      const event = new Event('lostpointercapture', {bubbles: true}); Object.defineProperty(event, 'pointerId', {value: id}); this.dispatchEvent(event);
    });
  } catch (cause) {restore(); throw cause;}
  return {
    flushFrames() {const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(0);},
    pendingFrames() {return frames.size;},
    captures() {return [...captures.values()].reduce((sum, ids) => sum + ids.size, 0);},
    setRect(rect: {left: number; top: number; width: number; height: number}) {rectangle = {...rect};},
    pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number, shift = false, modifiers: Pick<MouseEventInit, 'ctrlKey' | 'metaKey' | 'altKey'> = {}) {
      const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, shiftKey: shift, ...modifiers});
      Object.defineProperty(event, 'pointerId', {value: 7}); canvas.dispatchEvent(event);
    },
    wheel(canvas: HTMLCanvasElement, deltaY: number, deltaMode = 0) {
      const event = new Event('wheel', {bubbles: true, cancelable: true});
      for (const [key, value] of Object.entries({deltaY, deltaMode, ctrlKey: false, metaKey: false})) Object.defineProperty(event, key, {value});
      canvas.dispatchEvent(event);
    },
    dispose() {if (disposed) return; disposed = true; frames.clear(); captures.clear(); restore();},
  };
}
