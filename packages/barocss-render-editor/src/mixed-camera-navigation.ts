import { prepareCamera, validateMeshCamera } from '@barocss/gpu';
import type { MeshCamera } from '@barocss/gpu';
import { RenderMixedDocumentError } from './mixed-document.js';

export type RenderCameraInteraction =
  | { readonly kind: 'orbit' | 'pan'; readonly deltaX: number; readonly deltaY: number; readonly width: number; readonly height: number }
  | { readonly kind: 'zoom'; readonly factor: number };
type Vector = [number, number, number];

function interactionData(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new RenderMixedDocumentError('INPUT', 'Camera interaction must be a plain data object.');
  }
  const kind = Object.getOwnPropertyDescriptor(input, 'kind');
  if (!kind || !('value' in kind) || !kind.enumerable || !['orbit', 'pan', 'zoom'].includes(kind.value)) {
    throw new RenderMixedDocumentError('INPUT', 'Camera interaction kind must be orbit, pan or zoom.');
  }
  const keys = kind.value === 'zoom' ? ['kind', 'factor'] : ['kind', 'deltaX', 'deltaY', 'width', 'height'];
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    throw new RenderMixedDocumentError('INPUT', 'Camera interaction has missing or unsupported fields.');
  }
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new RenderMixedDocumentError('INPUT', `Camera interaction ${key} must be own enumerable data.`);
    }
    if (key !== 'kind' && (typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value))) {
      throw new RenderMixedDocumentError('INPUT', `Camera interaction ${key} must be a finite number.`);
    }
    data[key] = descriptor.value;
  }
  if (data.kind === 'zoom') {
    if ((data.factor as number) <= 0) throw new RenderMixedDocumentError('INPUT', 'Zoom factor must be positive.');
  } else {
    for (const key of ['width', 'height']) if ((data[key] as number) <= 0 || (data[key] as number) > 16384) {
      throw new RenderMixedDocumentError('INPUT', 'Camera CSS dimensions must be positive and at most 16384.');
    }
  }
  return data;
}
function unit(vector: Vector): Vector {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length) as Vector;
}
function rotate(vector: Vector, axis: Vector, angle: number): Vector {
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const dot = vector[0] * axis[0] + vector[1] * axis[1] + vector[2] * axis[2];
  const cross: Vector = [axis[1] * vector[2] - axis[2] * vector[1], axis[2] * vector[0] - axis[0] * vector[2], axis[0] * vector[1] - axis[1] * vector[0]];
  return vector.map((value, index) => value * cosine + cross[index] * sine + axis[index] * dot * (1 - cosine)) as Vector;
}

/** Gesture pose math over the public GPU basis. No source, projection or geometry kernel. */
export function deriveRenderCameraInteraction(camera: MeshCamera, interaction: RenderCameraInteraction): MeshCamera {
  const data = interactionData(interaction);
  try {
    const original = validateMeshCamera(camera);
    const width = data.kind === 'zoom' ? 1 : data.width as number, height = data.kind === 'zoom' ? 1 : data.height as number;
    const { view } = prepareCamera(original, width / height);
    const offset = original.eye.map((value, index) => value - original.target[index]) as Vector;
    if (data.kind === 'zoom') {
      if (data.factor === 1) return original;
      const eye = offset.map((value, index) => original.target[index] + value / (data.factor as number)) as Vector;
      return validateMeshCamera({ ...original, eye });
    }
    const deltaX = data.deltaX as number, deltaY = data.deltaY as number;
    if (deltaX === 0 && deltaY === 0) return original;
    const right = unit([view[0], view[4], view[8]]), vertical = unit([view[1], view[5], view[9]]);
    if (data.kind === 'pan') {
      const spanY = 2 * Math.hypot(...offset) * Math.tan(original.fovYDegrees * Math.PI / 360), spanX = spanY * width / height;
      const translation = right.map((value, index) => -value * deltaX / width * spanX + vertical[index] * deltaY / height * spanY) as Vector;
      return validateMeshCamera({ ...original,
        eye: original.eye.map((value, index) => value + translation[index]) as Vector,
        target: original.target.map((value, index) => value + translation[index]) as Vector });
    }
    const yaw = -2 * Math.PI * deltaX / width, pitch = -Math.PI * deltaY / height;
    const pitchedAxis = unit(rotate(right, vertical, yaw));
    const rotatedOffset = rotate(rotate(offset, vertical, yaw), pitchedAxis, pitch);
    // Scaling first keeps a large finite up magnitude out of intermediate products.
    const upScale = Math.max(...original.up.map(Math.abs));
    const scaledUp = original.up.map((value) => value / upScale) as Vector;
    const up = rotate(rotate(scaledUp, vertical, yaw), pitchedAxis, pitch).map((value) => value * upScale) as Vector;
    const eye = rotatedOffset.map((value, index) => original.target[index] + value) as Vector;
    return validateMeshCamera({ ...original, eye, up });
  } catch (cause) {
    throw new RenderMixedDocumentError('INPUT', 'Camera interaction was refused by the public camera validation.', cause);
  }
}
