import {
  BaroCADUniformCurveLoader,
  type BaroCadUniformCurveThreeResult,
  type BaroCadLoadTransportOptions,
} from '@barocss/cad-interop/three-uniform-curve';
import {
  validateBaroCadUniformCurveSourceOptions,
  type BaroCadUniformCurveSourceOptions,
} from '@barocss/cad-interop/native-uniform-curve';
import type { Group, Line, BufferGeometry, LineBasicMaterial } from 'three';
import type { Model, Point } from '@barocss/cad';

export function readUniform(source: string, input: unknown): BaroCadUniformCurveThreeResult {
  const options: BaroCadUniformCurveSourceOptions = validateBaroCadUniformCurveSourceOptions(input);
  const result: BaroCadUniformCurveThreeResult = new BaroCADUniformCurveLoader(options).parse(source);
  const group: Group = result.group;
  const line: Line<BufferGeometry, LineBasicMaterial> = result.line;
  const model: Model = result.model;
  const domain: [number, number] = result.domain;
  const parameters: number[] = result.parameters;
  const points: Point[] = result.pointsMM;
  const intervals: [number, number][] = result.intervals;
  const positions: Float32Array = result.positions;
  const mode: 'uniform-original-parameter' = result.mode;
  const approximateDisplay: true = result.quality.approximateDisplay;
  const adaptiveErrorBound: false = result.quality.adaptiveErrorBound;
  group.add(line);
  void [model, domain, parameters, points, intervals, positions, mode, approximateDisplay, adaptiveErrorBound];
  result.dispose();
  return result;
}

export function readUniformURL(url: string, signal: AbortSignal): Promise<BaroCadUniformCurveThreeResult> {
  const options: BaroCadUniformCurveSourceOptions = {
    sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 },
  };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) {
    const loaded: number = event.loadedBytes;
    const declared: number | undefined = event.declaredTotalBytes;
    const originalURL: string = event.url;
    void [loaded, declared, originalURL];
  } };
  return new BaroCADUniformCurveLoader(options).loadAsync(url, transport);
}
