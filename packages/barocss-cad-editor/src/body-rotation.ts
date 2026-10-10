import type { CadAffineMatrix3x4, Curve, Model, Surface } from '@barocss/cad';
import type { CadEditorBodyTranslationField, CadEditorRotationAxis } from './types.js';
import { transformBodySource } from './body-translation.js';

/** Right-handed world-axis rotation around the selected original pole, in authored mm. */
export function buildBodyRotationMatrix(pivotMM: [number, number, number], axis: CadEditorRotationAxis,
  angleDegrees: number): CadAffineMatrix3x4 {
  if (!Array.isArray(pivotMM) || pivotMM.length !== 3 || !pivotMM.every(Number.isFinite)
    || axis !== 'x' && axis !== 'y' && axis !== 'z'
    || !Number.isFinite(angleDegrees) || Math.abs(angleDegrees) > 360) {
    throw new RangeError('A finite pivot, world axis and angle from -360 to 360 degrees are required.');
  }
  const angle = angleDegrees % 360;
  if (angle === 0) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  let c: number, s: number;
  if (angle === 90 || angle === -270) { c = 0; s = 1; }
  else if (angle === -90 || angle === 270) { c = 0; s = -1; }
  else if (Math.abs(angle) === 180) { c = -1; s = 0; }
  else { const radians = angle * Math.PI / 180; c = Math.cos(radians); s = Math.sin(radians); }
  const negativeS = s === 0 ? 0 : -s;
  const r = axis === 'x' ? [1, 0, 0, 0, c, negativeS, 0, s, c]
    : axis === 'y' ? [c, 0, s, 0, 1, 0, negativeS, 0, c]
    : [c, negativeS, 0, s, c, 0, 0, 0, 1];
  const matrix: CadAffineMatrix3x4 = [r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0];
  for (let row = 0; row < 3; row++) {
    // A fixed/identity axis must retain its original coefficient bits in the native provider.
    const identity = r[row * 3 + row] === 1
      && [0, 1, 2].every(column => column === row || r[row * 3 + column] === 0);
    matrix[row * 4 + 3] = identity ? 0
      : pivotMM[row] - (r[row * 3] * pivotMM[0] + r[row * 3 + 1] * pivotMM[1] + r[row * 3 + 2] * pivotMM[2]);
  }
  return matrix;
}

export function rotateBodySource(source: string, model: Model, original: Curve | Surface,
  pivotMM: [number, number, number], axis: CadEditorRotationAxis, angleDegrees: number) {
  const requested: CadEditorBodyTranslationField[] = axis === 'x' ? ['yMM', 'zMM']
    : axis === 'y' ? ['xMM', 'zMM'] : ['xMM', 'yMM'];
  return transformBodySource(source, model, original, buildBodyRotationMatrix(pivotMM, axis, angleDegrees),
    requested, 'cad_editor_rotation');
}
