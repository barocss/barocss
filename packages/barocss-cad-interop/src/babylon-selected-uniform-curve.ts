import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import type { Geometry } from '@babylonjs/core/Meshes/geometry.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import { parseBaroCadSelectedUniformCurveSource, validateBaroCadSelectedUniformCurveSourceOptions } from './native-selected-uniform-curve.js';
import type { BaroCadSelectedUniformCurveSourceOptions, BaroCadSelectedUniformCurveSourceResult } from './native-selected-uniform-curve.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadSelectedUniformCurveSourceOptions } from './native-selected-uniform-curve.js';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadSelectedUniformCurveBabylonResult extends BaroCadSelectedUniformCurveSourceResult {
  /** Registered in the caller Scene, initially disabled. Enable after caller context validation. */
  readonly line: LinesMesh;
  /** Release only the original owned mesh/geometry/material once; native CPU data remain readable. */
  dispose(): void;
}

function validateScene(scene: Scene): void {
  if (!(scene instanceof Scene) || scene.isDisposed || scene.useRightHandedSystem !== true) {
    throw new RangeError('BaroCAD selected uniform Babylon loading requires an actual live right-handed Scene');
  }
}

/** Display one original Curve from complete Source0 using a caller-owned right-handed Babylon Scene. */
export class BaroCADSelectedUniformCurveBabylonLoader {
  readonly #options: BaroCadSelectedUniformCurveSourceOptions;

  constructor(options: BaroCadSelectedUniformCurveSourceOptions) {
    this.#options = validateBaroCadSelectedUniformCurveSourceOptions(options);
  }

  parse(source: string, scene: Scene): BaroCadSelectedUniformCurveBabylonResult {
    validateScene(scene);
    const native = parseBaroCadSelectedUniformCurveSource(source, this.#options);
    const previousMeshes = new Set(scene.meshes);
    let line: LinesMesh | undefined;
    let geometry: Geometry | undefined;
    let material: ShaderMaterial | undefined;
    let materialDisposed = false;
    try {
      material = new ShaderMaterial(`${native.model.name}:${native.curveId}:selected_uniform_material`, scene, 'color', {
        attributes: ['position'], uniforms: ['world', 'viewProjection', 'color'], needAlphaBlending: false,
      }, false);
      material.onDisposeObservable.add(() => { materialDisposed = true; });
      const points: Vector3[] = [];
      for (let index = 0; index < native.positions.length; index += 3) points.push(new Vector3(native.positions[index], native.positions[index + 1], native.positions[index + 2]));
      line = CreateLines(`${native.model.name}:${native.curveId}`, { points, useVertexAlpha: false, material }, scene);
      line.setEnabled(false);
      geometry = line.geometry ?? undefined;
      if (!geometry) throw new RangeError('Babylon selected uniform Line construction did not produce an owned geometry');
      // Immutable CreateLines uses number[] storage; keep a distinct actual Float32 target copy.
      line.setVerticesData('position', Float32Array.from(native.positions), false, 3);
      line.color = new Color3(40 / 255, 201 / 255, 235 / 255);
      line.metadata = { barocss: {
        role: 'selected-uniform-curve-display-line', modelName: native.model.name, curveId: native.curveId,
        sourceVersion: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', mode: native.mode,
        selectedObjectIndex: native.selectedObjectIndex, unrenderedObjectIds: [...native.unrenderedObjectIds], nativeDomain: [...native.domain],
        nativeParameters: [...native.parameters], nativeIntervals: native.intervals.map(interval => [...interval]), quality: { ...native.quality },
      } };
    } catch (error) {
      // A completed internal LinesMesh can register before CreateLines returns. Limit cleanup by owned material identity.
      const completed = new Set<LinesMesh>();
      if (line) completed.add(line);
      if (material) for (const mesh of scene.meshes) if (!previousMeshes.has(mesh) && mesh instanceof LinesMesh && mesh.material === material) completed.add(mesh);
      try {
        try {
          for (const mesh of completed) if (!mesh.isDisposed()) mesh.dispose(true, false, true);
          if (geometry && !geometry.isDisposed()) geometry.dispose();
        } finally {
          if (material && !materialDisposed) material.dispose(false, false, true);
        }
      } catch { /* Preserve the original construction error. */ }
      throw error;
    }
    const ownedLine = line, ownedGeometry = geometry, ownedMaterial = material;
    let disposed = false;
    return { ...native, line: ownedLine, dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const currentGeometry = ownedLine.geometry;
        if (currentGeometry && currentGeometry !== ownedGeometry) currentGeometry.releaseForMesh(ownedLine, false);
        if (!ownedLine.isDisposed()) ownedLine.dispose(true, false, true);
      } finally {
        try { if (!ownedGeometry.isDisposed()) ownedGeometry.dispose(); }
        finally { if (!materialDisposed) ownedMaterial.dispose(false, false, true); }
      }
    } };
  }

  /** Bounded shared source transport; returns a disabled candidate and cleans it if an abort/Scene guard fails. */
  async loadAsync(url: string, scene: Scene, transport: BaroCadLoadTransportOptions = {}): Promise<BaroCadSelectedUniformCurveBabylonResult> {
    validateScene(scene);
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadSelectedUniformCurveBabylonResult | undefined;
    try {
      result = this.parse(source, scene);
      await Promise.resolve();
      throwIfBaroCadAborted(request.signal);
      validateScene(scene);
      return result;
    } catch (error) {
      result?.dispose();
      throw error;
    }
  }
}
