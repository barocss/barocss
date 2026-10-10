import {RenderMixedDocumentError} from './mixed-document.js';
import type {RenderMixedController} from './mixed-controller.js';
import {createCameraInput} from './camera-input.js';

/** Mixed-error wrapper around the shared private DOM transport. */
export function createMixedCameraInput(canvas: HTMLCanvasElement, controller: RenderMixedController, options: {
  mode: () => 'orbit' | 'pan'; onError: (error: RenderMixedDocumentError) => void; canNavigate?: () => boolean;
}) {
  return createCameraInput(canvas, controller, {...options, normalizeError: cause => {
    const original = cause instanceof Error && cause.message === 'Wheel input must be finite.'
      ? new RenderMixedDocumentError('INPUT', cause.message) : cause;
    return new RenderMixedDocumentError('INPUT', 'The camera move could not be previewed.', original);
  }});
}
