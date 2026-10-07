import { MeshRenderer } from './mesh-renderer.js';
import { GPUError } from './renderer.js';
import type { UpdateResult } from './renderer.js';
import type { MeshOptions, PreviewPacket } from './mesh-packet.js';
import type { MeshCamera } from './camera.js';
import type { MeshEdgeOverlay } from './edge-overlay.js';
import type { MeshFaceHighlight } from './face-highlight.js';
import type { MeshObjectHighlight } from './object-highlight.js';

/** Host-resolved native face and/or scene object selection. */
export interface MeshViewportSelection {
  face?: MeshFaceHighlight | null;
  object?: MeshObjectHighlight | null;
}
export type MeshViewportState =
  | { readonly kind: 'empty'; readonly packet: null; readonly edgeOverlay: null; readonly selection: null }
  | { readonly kind: 'mesh'; readonly packet: PreviewPacket; readonly edgeOverlay: MeshEdgeOverlay | null;
      readonly selection: MeshViewportSelection };

/** A stable WebGL2 viewport whose accepted display can contain no geometry. */
export class MeshViewport {
  private readonly renderer: MeshRenderer;
  constructor(canvas: HTMLCanvasElement, options: MeshOptions) {
    this.renderer = MeshRenderer.empty(canvas, options);
  }
  get options(): MeshOptions { return this.renderer.options; }
  get state(): MeshViewportState {
    if (this.renderer.empty) return Object.freeze({ kind: 'empty', packet: null, edgeOverlay: null, selection: null });
    return Object.freeze({ kind: 'mesh', packet: this.renderer.packet, edgeOverlay: this.renderer.edgeOverlay,
      selection: { face: this.renderer.faceHighlight, object: this.renderer.objectHighlight } });
  }
  get lighting() { return this.renderer.lighting; }
  update(packet: PreviewPacket, options: MeshOptions, overlay?: MeshEdgeOverlay | null,
    selection?: MeshViewportSelection | null): UpdateResult {
    try {
      if (selection !== undefined && selection !== null) {
        if (Object.getPrototypeOf(selection) !== Object.prototype) throw new GPUError('Selection must be plain data');
        for (const key of Reflect.ownKeys(selection)) {
          const descriptor = Object.getOwnPropertyDescriptor(selection, key)!;
          if ((key !== 'face' && key !== 'object') || !descriptor.enumerable || !('value' in descriptor)) {
            throw new GPUError('Selection contains unsupported fields');
          }
        }
      }
      return this.renderer.update(packet, options, overlay,
        selection === null ? null : selection?.face, selection === null ? null : selection?.object);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error : new GPUError('Viewport update failed') };
    }
  }
  clear(options?: MeshOptions): UpdateResult { return this.renderer.clear(options); }
  setCamera(camera: MeshCamera): UpdateResult {
    try {
      const options = { ...this.options, camera };
      return this.renderer.empty ? this.clear(options) : this.update(this.renderer.packet, options);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error : new GPUError('Camera update failed') };
    }
  }
  resize(width: number, height: number): void { this.renderer.resize(width, height); }
  render(): void { this.renderer.render(); }
  readPixels(): Uint8Array { return this.renderer.readPixels(); }
  dispose(): void { this.renderer.dispose(); }
}

export function mountMeshViewport(canvas: HTMLCanvasElement, options: MeshOptions): MeshViewport {
  return new MeshViewport(canvas, options);
}
