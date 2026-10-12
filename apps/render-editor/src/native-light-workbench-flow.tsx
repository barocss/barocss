import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {RenderNativeLightDocument} from '@barocss/render-editor';
import {NativeLightWorkbench} from './native-light-workbench';

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
    pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number, shift = false) {
      const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, shiftKey: shift});
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
