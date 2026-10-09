import {
  parseBaroCadSource,
  type BaroCadNativeCapacityV1,
  type BaroCadNativeResult,
  type BaroCadParseOptions,
} from '@barocss/cad-interop/native';
import { BaroCADBabylonLoader, type BaroCadBabylonResult } from '@barocss/cad-interop/babylon';
import type { Scene } from '@babylonjs/core/scene.js';

/** New options per caller-owned host. Native millimetres become scene metres. */
export function createBabylonHostOptions(): BaroCadParseOptions {
  const nativeCapacity: BaroCadNativeCapacityV1 = { version: 1, maximumObjects: 16 };
  return { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001, nativeCapacity };
}

/** Neutral results own CPU data and retain the original source and native Model. */
export function readBabylonHostNative(source: string): BaroCadNativeResult {
  return parseBaroCadSource(source, createBabylonHostOptions());
}

/** Meshes attach to the supplied Scene; result.dispose() releases only their resources. */
export function addBabylonHostSource(source: string, scene: Scene): BaroCadBabylonResult {
  return new BaroCADBabylonLoader(scene, createBabylonHostOptions()).parse(source);
}

/** The caller chooses a live right-handed Scene before loading. Options stay stable until completion. */
export async function loadBabylonHostSource(
  url: string, scene: Scene, signal?: AbortSignal,
): Promise<BaroCadBabylonResult> {
  return new BaroCADBabylonLoader(scene, createBabylonHostOptions()).loadAbortable(url, { signal });
}
