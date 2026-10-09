import {
  parseBaroCadSource,
  type BaroCadCurveDisplayV1,
  type BaroCadNativeCapacityV1,
  type BaroCadNativeResult,
  type BaroCadParseOptions,
} from '@barocss/cad-interop/native';
import { BaroCADLoader, type BaroCadThreeResult } from '@barocss/cad-interop/three';
import { BaroCADBabylonLoader, type BaroCadBabylonResult } from '@barocss/cad-interop/babylon';
import { BaroCADPixi3DLoader, type BaroCadPixi3DResult } from '@barocss/cad-interop/pixi3d';
import type { Scene as ThreeScene } from 'three';
import type { Scene as BabylonScene } from '@babylonjs/core/scene.js';
import type { Container } from 'pixi.js';

/** Fresh parse options for complete source0 Models with 1..16 native objects. */
export function createQuickstartOptions(): BaroCadParseOptions {
  const nativeCapacity: BaroCadNativeCapacityV1 = { version: 1, maximumObjects: 16 };
  const curveDisplay: BaroCadCurveDisplayV1 = {
    version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16,
  };
  return {
    sourceVersion: 0, countU: 8, countV: 8,
    // Native source stays in millimetres; display positions use metres.
    unitsPerMillimeter: 0.001, nativeCapacity, curveDisplay,
  };
}

/** Source and Model remain native authority; preview buffers are derived. */
export function parseNativeSource(source: string): BaroCadNativeResult {
  return parseBaroCadSource(source, createQuickstartOptions());
}

/** The caller owns Scene, camera and renderer. Release this result with dispose(). */
export function addThreeSource(source: string, scene: ThreeScene): BaroCadThreeResult {
  const result = new BaroCADLoader(createQuickstartOptions()).parse(source);
  scene.add(result.group);
  return result;
}

/** The caller supplies a live right-handed Y-up Scene and retains its engine. */
export function addBabylonSource(source: string, scene: BabylonScene): BaroCadBabylonResult {
  // The host chooses its basis before loading; this helper does not change it.
  if (!scene.useRightHandedSystem) {
    throw new RangeError('Use a caller-owned Babylon scene with useRightHandedSystem === true');
  }
  return new BaroCADBabylonLoader(scene, createQuickstartOptions()).parse(source);
}

/** The caller owns Stage/Application/camera; dispose() releases this result's root. */
export function addPixi3DSource(source: string, stage: Container): BaroCadPixi3DResult {
  const result = new BaroCADPixi3DLoader(createQuickstartOptions()).parse(source);
  stage.addChild(result.root);
  return result;
}
