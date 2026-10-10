import {RenderEditorError} from './errors.js';
import type {RenderEditorController} from './controller.js';
import {createCameraInput} from './camera-input.js';

/** Source-error wrapper; actual renderer errors pass through without replacement. */
export function createSceneCameraInput(canvas: HTMLCanvasElement, controller: RenderEditorController, options: {
  mode: () => 'orbit' | 'pan'; onError: (error: RenderEditorError) => void; canNavigate?: () => boolean;
}) {
  return createCameraInput(canvas, controller, {...options, normalizeError: cause => {
    const error = new RenderEditorError('DOCUMENT_INPUT', 'The camera move could not be previewed.');
    Object.defineProperty(error, 'cause', {value: cause, enumerable: false, configurable: true});
    return error;
  }});
}
