import {RenderEditorError} from './errors.js';
import type {RenderEditorController} from './controller.js';
import {createCameraInput} from './camera-input.js';

/** Source-error wrapper; actual renderer errors pass through without replacement. */
export function createSceneCameraInput(canvas: HTMLCanvasElement, controller: RenderEditorController, options: {
  mode: () => 'orbit' | 'pan'; onError: (error: RenderEditorError) => void; canNavigate?: () => boolean;
}) {
  // The shared transport's private preview slot is the actual local camera.
  // It does not invoke the public legacy authoring-preview methods.
  const local = {
    session: controller.session,
    getSnapshot: () => {
      const snapshot = controller.getSnapshot();
      return {...snapshot, cameraPreview: snapshot.viewportCamera};
    },
    subscribe: (listener: () => void) => controller.subscribe(listener),
    previewCamera: (camera: Parameters<RenderEditorController['navigateViewportCamera']>[0]) => controller.navigateViewportCamera(camera),
    cancelCameraPreview: () => controller.resetViewportCamera(),
  };
  return createCameraInput(canvas, local, {...options, canNavigate: () => {
    const snapshot = controller.getSnapshot();
    return !snapshot.cameraPreview && !snapshot.transformPreview && !snapshot.animationPreview && (options.canNavigate?.() ?? true);
  }, normalizeError: cause => {
    const error = new RenderEditorError('DOCUMENT_INPUT', 'The viewport camera could not move.');
    Object.defineProperty(error, 'cause', {value: cause, enumerable: false, configurable: true});
    return error;
  }});
}
