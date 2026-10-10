import {
  BaroCADUniformCurveBabylonLoader,
  type BaroCadUniformCurveBabylonResult,
  type BaroCadUniformCurveSourceOptions,
  type BaroCadLoadTransportOptions,
} from '@barocss/cad-interop/babylon-uniform-curve';
import type { Scene } from '@babylonjs/core/scene.js';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import type { Model, Point } from '@barocss/cad';

export function parseUniform(source: string, scene: Scene, options: BaroCadUniformCurveSourceOptions): BaroCadUniformCurveBabylonResult {
  const result: BaroCadUniformCurveBabylonResult = new BaroCADUniformCurveBabylonLoader(options).parse(source, scene);
  const line: LinesMesh = result.line;
  const model: Model = result.model;
  const domain: [number, number] = result.domain;
  const parameters: number[] = result.parameters;
  const points: Point[] = result.pointsMM;
  const intervals: [number, number][] = result.intervals;
  const positions: Float32Array = result.positions;
  const mode: 'uniform-original-parameter' = result.mode;
  const approximateDisplay: true = result.quality.approximateDisplay;
  const adaptiveErrorBound: false = result.quality.adaptiveErrorBound;
  line.setEnabled(true);
  void [model, domain, parameters, points, intervals, positions, mode, approximateDisplay, adaptiveErrorBound];
  result.dispose();
  return result;
}

export function loadUniform(url: string, scene: Scene, signal: AbortSignal): Promise<BaroCadUniformCurveBabylonResult> {
  const options: BaroCadUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) {
    const originalURL: string = event.url;
    const bytes: number = event.loadedBytes;
    const declaredTotal: number | undefined = event.declaredTotalBytes;
    void [originalURL, bytes, declaredTotal];
  } };
  return new BaroCADUniformCurveBabylonLoader(options).loadAsync(url, scene, transport);
}
