import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { DRAW_MODES } from 'pixi.js';
import { parseBaroCadUniformCurveSource, validateBaroCadUniformCurveSourceOptions } from './native-uniform-curve.js';
import type { BaroCadUniformCurveSourceOptions, BaroCadUniformCurveSourceResult } from './native-uniform-curve.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadUniformCurveSourceOptions } from './native-uniform-curve.js';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadUniformCurvePixi3DResult extends BaroCadUniformCurveSourceResult {
  /** Detached owned root containing one identity-pose uniform world Curve mesh. */
  readonly root: Container3D;
  readonly mesh: Mesh3D;
  /** Release original owned resources once. Caller replacements/children stay live; children are detached. */
  dispose(): void;
}

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[index + axis]);
    max[axis] = Math.max(max[axis], positions[index + axis]);
  }
  return { min, max };
}

/** Explicit uniform source0 Curve adapter for the real Pixi3D2.5/PixiJS7 browser environment. */
export class BaroCADUniformCurvePixi3DLoader {
  readonly #options: BaroCadUniformCurveSourceOptions;

  constructor(options: BaroCadUniformCurveSourceOptions) {
    this.#options = validateBaroCadUniformCurveSourceOptions(options);
  }

  parse(source: string): BaroCadUniformCurvePixi3DResult {
    const native = parseBaroCadUniformCurveSource(source, this.#options);
    let root: Container3D | undefined;
    let mesh: Mesh3D | undefined;
    let geometry: MeshGeometry3D | undefined;
    let material: StandardMaterial | undefined;
    try {
      root = new Container3D();
      root.name = native.model.name;
      geometry = new MeshGeometry3D();
      const positions = Float32Array.from(native.positions), count = positions.length / 3;
      geometry.positions = { buffer: positions, componentType: 5126, componentCount: 3, normalized: false, ...bounds(positions) };
      // Derived unlit shader input, not native Curve normals.
      const shaderNormals = new Float32Array(positions.length);
      for (let index = 2; index < shaderNormals.length; index += 3) shaderNormals[index] = 1;
      geometry.normals = { buffer: shaderNormals, componentType: 5126, componentCount: 3, normalized: false };
      geometry.indices = { buffer: Uint16Array.from({ length: count }, (_, index) => index), componentType: 5123, componentCount: 1, normalized: false };
      material = new StandardMaterial();
      material.unlit = true;
      material.doubleSided = true;
      material.baseColor = new Color(40 / 255, 201 / 255, 235 / 255);
      material.drawMode = DRAW_MODES.LINE_STRIP;
      mesh = new Mesh3D(geometry, material);
      mesh.name = native.curveId;
      root.addChild(mesh);
    } catch (error) {
      try {
        try {
          mesh?.parent?.removeChild(mesh);
          mesh?.destroy({ children: false, geometry: false, material: false });
        } finally {
          try { geometry?.destroy(); }
          finally {
            try { material?.destroy(); }
            finally { root?.destroy({ children: false }); }
          }
        }
      } catch { /* Preserve the original construction error. */ }
      throw error;
    }
    const ownedRoot = root, ownedMesh = mesh, ownedGeometry = geometry, ownedMaterial = material;
    let disposed = false;
    return { ...native, root: ownedRoot, mesh: ownedMesh, dispose() {
      if (disposed) return;
      disposed = true;
      ownedRoot.parent?.removeChild(ownedRoot);
      ownedMesh.parent?.removeChild(ownedMesh);
      try { ownedMesh.destroy({ children: false, geometry: false, material: false }); }
      finally {
        try { ownedGeometry.destroy(); }
        finally {
          try { ownedMaterial.destroy(); }
          finally { ownedRoot.destroy({ children: false }); }
        }
      }
    } };
  }

  /** Bounded shared source transport. Abort after completed allocation releases only the obtained target. */
  async loadAsync(url: string, transport: BaroCadLoadTransportOptions = {}): Promise<BaroCadUniformCurvePixi3DResult> {
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadUniformCurvePixi3DResult | undefined;
    try {
      result = this.parse(source);
      await Promise.resolve();
      throwIfBaroCadAborted(request.signal);
      return result;
    } catch (error) {
      result?.dispose();
      throw error;
    }
  }
}
