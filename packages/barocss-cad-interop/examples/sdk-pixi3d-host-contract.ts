import {
  parseBaroCadSource,
  type BaroCadCurveDisplayV1,
  type BaroCadLoadTransportOptions,
  type BaroCadNativeCapacityV1,
  type BaroCadNativeResult,
  type BaroCadParseOptions,
} from '@barocss/cad-interop/native';
import { BaroCADPixi3DLoader, type BaroCadPixi3DResult } from '@barocss/cad-interop/pixi3d';
import type { Container } from 'pixi.js';

/** Fresh options for source0 Models; native data stays in millimetres. */
export function createPixiHostOptions(): BaroCadParseOptions {
  const nativeCapacity: BaroCadNativeCapacityV1 = { version: 1, maximumObjects: 16 };
  const curveDisplay: BaroCadCurveDisplayV1 = {
    version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16,
  };
  return {
    sourceVersion: 0, countU: 8, countV: 8,
    unitsPerMillimeter: 0.001, nativeCapacity, curveDisplay,
  };
}

/** Source/Model and native U/V remain authoritative; buffers are derived display data. */
export function parsePixiHostNativeSource(source: string): BaroCadNativeResult {
  return parseBaroCadSource(source, createPixiHostOptions());
}

function attachResult(stage: Container, result: BaroCadPixi3DResult): BaroCadPixi3DResult {
  try {
    stage.addChild(result.root);
    return result;
  } catch (error) {
    result.dispose();
    throw error;
  }
}

/** Caller owns Stage/Application/camera/lights; result.dispose() releases its root/resources. */
export function attachPixiHostSource(source: string, stage: Container): BaroCadPixi3DResult {
  const result = new BaroCADPixi3DLoader(createPixiHostOptions()).parse(source);
  return attachResult(stage, result);
}

/** Load bounded source over HTTP(S) using the caller's signal and optional progress callback. */
export async function loadPixiHostSource(
  url: string,
  stage: Container,
  signal: AbortSignal,
  onProgress?: BaroCadLoadTransportOptions['onProgress'],
): Promise<BaroCadPixi3DResult> {
  // The renderer API validates parse options after fetching. This helper keeps
  // its fresh local options unchanged while awaiting that existing load flow.
  const loader = new BaroCADPixi3DLoader(createPixiHostOptions());
  const transport: BaroCadLoadTransportOptions = { signal, onProgress };
  const result = await loader.loadAbortable(url, transport);
  return attachResult(stage, result);
}
