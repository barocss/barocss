// The viewer's refusals (R7.3a): one BarocssError class, its code saying which input was refused. Its own module so the
// viewer's geometry, lights and math refuse with it too, with no import cycle.
import { BarocssError } from '../core/barocss-error.js';

export type ViewerErrorCode =
  // The device and its programs.
  | 'WEBGPU_UNAVAILABLE' | 'NO_ADAPTER' | 'NO_CONTEXT' | 'SHADER' | 'PIPELINE' | 'DISPOSED' | 'DEVICE_LOST'
  // A caller's input (batch 3): geometry and its fields, instances, a transform, a colour map or colour, a shader
  // material's params, clip planes, a texture, the backing size, a matrix that has no inverse.
  | 'GEOMETRY_INVALID' | 'INSTANCES_INVALID' | 'TRANSFORM_INVALID' | 'COLOR_MAP_INVALID' | 'COLOR_INVALID'
  | 'MATERIAL_INVALID' | 'CLIP_INVALID' | 'TEXTURE_INVALID' | 'SIZE_INVALID' | 'MATRIX_SINGULAR';

export class ViewerError extends BarocssError {
  constructor(readonly code: ViewerErrorCode, message: string) { super(code, message); this.name = 'ViewerError'; }
}
