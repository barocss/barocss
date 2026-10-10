import { BaroCADSelectedUniformCurveBabylonLoader, type BaroCadSelectedUniformCurveBabylonResult, type BaroCadLoadTransportOptions } from '@barocss/cad-interop/babylon-selected-uniform-curve';
import { validateBaroCadSelectedUniformCurveSourceOptions, type BaroCadSelectedUniformCurveSourceOptions } from '@barocss/cad-interop/native-selected-uniform-curve';
import type { Curve, Model, Point } from '@barocss/cad';
import type { Scene } from '@babylonjs/core/scene.js';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';

export function parseSelected(source: string, scene: Scene, input: unknown): BaroCadSelectedUniformCurveBabylonResult {
  const options: BaroCadSelectedUniformCurveSourceOptions = validateBaroCadSelectedUniformCurveSourceOptions(input);
  const result = new BaroCADSelectedUniformCurveBabylonLoader(options).parse(source, scene);
  const line: LinesMesh = result.line, model: Model = result.model, curve: Curve = result.curve;
  const ordinal: number = result.selectedObjectIndex, unrendered: string[] = result.unrenderedObjectIds;
  const domain: [number, number] = result.domain, intervals: [number, number][] = result.intervals, points: Point[] = result.pointsMM, positions: Float32Array = result.positions;
  line.setEnabled(true); void [model, curve, ordinal, unrendered, domain, intervals, points, positions]; result.dispose(); return result;
}
export function loadSelected(url: string, scene: Scene, signal: AbortSignal): Promise<BaroCadSelectedUniformCurveBabylonResult> {
  const options: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, curveId: 'target_curve', unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) { const bytes: number = event.loadedBytes; void bytes; } };
  return new BaroCADSelectedUniformCurveBabylonLoader(options).loadAsync(url, scene, transport);
}
export function rejectInvalidCalls(source: string, scene: Scene): void {
  const options: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, curveId: 'target_curve', unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }, loader = new BaroCADSelectedUniformCurveBabylonLoader(options);
  // @ts-expect-error A genuine typed Scene is required, not a handedness flag object.
  loader.parse(source, { useRightHandedSystem: true });
  // @ts-expect-error Explicit original ID selection is a string, not an ordinal.
  new BaroCADSelectedUniformCurveBabylonLoader({ ...options, curveId: 1 });
  // @ts-expect-error Bounded transport rejects additional FileLoader headers.
  loader.loadAsync('source0.css', scene, { headers: {} });
}
