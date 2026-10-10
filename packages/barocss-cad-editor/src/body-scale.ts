import type { CadAffineMatrix3x4, Curve, Model, Surface } from '@barocss/cad';
import type { CadEditorBodyTranslationField, CadEditorScaleAxis } from './types.js';
import { transformBodySource } from './body-translation.js';

/** Positive native world-axis scaling around an original pole in authored mm. */
export function buildBodyScaleMatrix(pivotMM: [number, number, number], axis: CadEditorScaleAxis,
  factor: number): CadAffineMatrix3x4 {
  if (!Array.isArray(pivotMM) || pivotMM.length !== 3 || !pivotMM.every(Number.isFinite)
    || axis !== 'uniform' && axis !== 'x' && axis !== 'y' && axis !== 'z'
    || !Number.isFinite(factor) || factor < 0.001 || factor > 100) {
    throw new RangeError('A finite pivot, scale axis and factor from 0.001 to 100 are required.');
  }
  const diagonal = ['x', 'y', 'z'].map(name => axis === 'uniform' || axis === name ? factor : 1);
  // Exact identity rows are required for the native provider's signed-zero bit copy.
  const offsets = diagonal.map((value, index) => value === 1 ? 0 : pivotMM[index] * (1 - value));
  return [diagonal[0], 0, 0, offsets[0], 0, diagonal[1], 0, offsets[1], 0, 0, diagonal[2], offsets[2]];
}

export function scaleBodySource(source: string, model: Model, original: Curve | Surface,
  pivotMM: [number, number, number], axis: CadEditorScaleAxis, factor: number) {
  const requested: CadEditorBodyTranslationField[] = axis === 'uniform' ? ['xMM', 'yMM', 'zMM']
    : axis === 'x' ? ['xMM'] : axis === 'y' ? ['yMM'] : ['zMM'];
  return transformBodySource(source, model, original, buildBodyScaleMatrix(pivotMM, axis, factor),
    requested, 'cad_editor_scale');
}
