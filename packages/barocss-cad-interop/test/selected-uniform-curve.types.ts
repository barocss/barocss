import {
  parseBaroCadSelectedUniformCurveSource, validateBaroCadSelectedUniformCurveSourceOptions,
  type BaroCadSelectedUniformCurveSourceOptions, type BaroCadSelectedUniformCurveSourceResult,
} from '@barocss/cad-interop/native-selected-uniform-curve';
import { BaroCADSelectedUniformCurveLoader, type BaroCadSelectedUniformCurveThreeResult, type BaroCadLoadTransportOptions } from '@barocss/cad-interop/three-selected-uniform-curve';
import type { Curve, Model, Point } from '@barocss/cad';
import type { Group, Line, BufferGeometry, LineBasicMaterial } from 'three';

export function readSelected(source: string, input: unknown): BaroCadSelectedUniformCurveThreeResult {
  const options: BaroCadSelectedUniformCurveSourceOptions = validateBaroCadSelectedUniformCurveSourceOptions(input);
  const native: BaroCadSelectedUniformCurveSourceResult = parseBaroCadSelectedUniformCurveSource(source, options);
  const model: Model = native.model, curve: Curve = native.curve;
  const points: Point[] = native.pointsMM, domain: [number, number] = native.domain, intervals: [number, number][] = native.intervals;
  const positions: Float32Array = native.positions, selectedObjectIndex: number = native.selectedObjectIndex, siblings: string[] = native.unrenderedObjectIds;
  const format: 'barocad-selected-uniform-curve-preview' = native.format;
  const result = new BaroCADSelectedUniformCurveLoader(options).parse(source);
  const group: Group = result.group, line: Line<BufferGeometry, LineBasicMaterial> = result.line;
  group.add(line); void [model, curve, points, domain, intervals, positions, selectedObjectIndex, siblings, format];
  result.dispose(); return result;
}

export function readSelectedURL(url: string, signal: AbortSignal): Promise<BaroCadSelectedUniformCurveThreeResult> {
  const options: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, curveId: 'target_curve', uniformCurveDisplay: { version: 1, count: 129 } };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) { const loaded: number = event.loadedBytes; void loaded; } };
  return new BaroCADSelectedUniformCurveLoader(options).loadAsync(url, transport);
}

export function rejectIncorrectPublicInputs(source: string): void {
  const base = { sourceVersion: 0 as const, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1 as const, count: 129 } };
  // @ts-expect-error Explicit original curveId is required; no implicit first-object selection.
  parseBaroCadSelectedUniformCurveSource(source, base);
  // @ts-expect-error Original selection IDs are strings, not source-order ordinals.
  new BaroCADSelectedUniformCurveLoader({ ...base, curveId: 1 });
  // @ts-expect-error Selected uniform options have no adaptive curveDisplay field.
  new BaroCADSelectedUniformCurveLoader({ ...base, curveId: 'target_curve', curveDisplay: { chordToleranceMM: 1 } });
  // @ts-expect-error Display profile version is explicitly1.
  new BaroCADSelectedUniformCurveLoader({ ...base, curveId: 'target_curve', uniformCurveDisplay: { version: 0, count: 129 } });
}
