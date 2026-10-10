import {
  BaroCADUniformCurvePixi3DLoader,
  type BaroCadUniformCurvePixi3DResult,
  type BaroCadUniformCurveSourceOptions,
  type BaroCadLoadTransportOptions,
} from '@barocss/cad-interop/pixi3d-uniform-curve';
import { StandardMaterial } from 'pixi3d/pixi7';
import type { Camera, Container3D, Mesh3D } from 'pixi3d/pixi7';
import type { Model, Point } from '@barocss/cad';

export function parseUniform(source: string, options: BaroCadUniformCurveSourceOptions, camera: Camera): BaroCadUniformCurvePixi3DResult {
  const result: BaroCadUniformCurvePixi3DResult = new BaroCADUniformCurvePixi3DLoader(options).parse(source);
  const root: Container3D = result.root;
  const mesh: Mesh3D = result.mesh;
  const model: Model = result.model;
  const domain: [number, number] = result.domain;
  const parameters: number[] = result.parameters;
  const points: Point[] = result.pointsMM;
  const intervals: [number, number][] = result.intervals;
  const positions: Float32Array = result.positions;
  const mode: 'uniform-original-parameter' = result.mode;
  const approximateDisplay: true = result.quality.approximateDisplay;
  const adaptiveErrorBound: false = result.quality.adaptiveErrorBound;
  if (mesh.material instanceof StandardMaterial) mesh.material.camera = camera;
  root.addChild(mesh);
  void [model, domain, parameters, points, intervals, positions, mode, approximateDisplay, adaptiveErrorBound];
  result.dispose();
  return result;
}

export function loadUniform(url: string, signal: AbortSignal): Promise<BaroCadUniformCurvePixi3DResult> {
  const options: BaroCadUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) {
    const originalURL: string = event.url;
    const bytes: number = event.loadedBytes;
    const declared: number | undefined = event.declaredTotalBytes;
    void [originalURL, bytes, declared];
  } };
  return new BaroCADUniformCurvePixi3DLoader(options).loadAsync(url, transport);
}
