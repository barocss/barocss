import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { parseBaroCadSource } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadPixi3DResult extends BaroCadNativeResult {
  /** Owned display root. Original CAD identity is in model and renderedSurfaces. */
  root: Container3D;
  renderedSurfaces: ReadonlyArray<Readonly<{ surfaceId: string; mesh: Mesh3D }>>;
  /** Idempotent. Releases adapter resources, not the caller Application or stage. */
  dispose(): void;
}

function limits(buffer: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < buffer.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], buffer[i + axis]);
      max[axis] = Math.max(max[axis], buffer[i + axis]);
    }
  }
  return { min, max };
}

function disposeMesh(mesh: Mesh3D): void {
  mesh.parent?.removeChild(mesh);
  mesh.destroy({ children: false, geometry: true, material: true });
}

/** Pixi3D 2.5.0 / PixiJS 7.2.4 Surface display adapter for native source0. */
export class BaroCADPixi3DLoader {
  constructor(private readonly options: BaroCadParseOptions) {}

  parse(source: string): BaroCadPixi3DResult {
    if (this.options?.curveDisplay !== undefined) {
      throw new RangeError('BaroCAD Pixi3D does not support curveDisplay');
    }
    const native = parseBaroCadSource(source, this.options);
    const root = new Container3D();
    const owned: Mesh3D[] = [];
    const renderedSurfaces: Array<Readonly<{ surfaceId: string; mesh: Mesh3D }>> = [];
    try {
      for (const surface of native.surfaces) {
        const geometry = new MeshGeometry3D();
        let material: StandardMaterial | undefined;
        let mesh: Mesh3D | undefined;
        try {
          const positions = Float32Array.from(surface.mesh.positions);
          geometry.positions = {
            buffer: positions, componentType: 5126, componentCount: 3,
            normalized: false, ...limits(positions),
          };
          geometry.normals = {
            buffer: Float32Array.from(surface.mesh.normals),
            componentType: 5126, componentCount: 3, normalized: false,
          };
          geometry.indices = {
            buffer: Uint16Array.from(surface.mesh.indices),
            componentType: 5123, componentCount: 1, normalized: false,
          };
          // Native U/V remains in surface.mesh.parameters, not texture UV.
          material = new StandardMaterial();
          material.unlit = true;
          material.doubleSided = true;
          material.baseColor = new Color(0.3, 0.7, 0.9);
          mesh = new Mesh3D(geometry, material);
          owned.push(mesh);
          root.addChild(mesh);
          renderedSurfaces.push(Object.freeze({ surfaceId: surface.surfaceId, mesh }));
        } catch (error) {
          if (!mesh) {
            geometry.destroy();
            material?.destroy();
          }
          throw error;
        }
      }
    } catch (error) {
      for (const mesh of owned) disposeMesh(mesh);
      root.destroy({ children: false });
      throw error;
    }
    let disposed = false;
    return {
      ...native, root, renderedSurfaces: Object.freeze(renderedSurfaces),
      dispose() {
        if (disposed) return;
        disposed = true;
        root.parent?.removeChild(root);
        for (const mesh of owned) disposeMesh(mesh);
        root.destroy({ children: false });
      },
    };
  }

  async loadAbortable(url: string, transport: BaroCadLoadTransportOptions = {}): Promise<BaroCadPixi3DResult> {
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadPixi3DResult | undefined;
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

  loadAsync(url: string): Promise<BaroCadPixi3DResult> {
    return this.loadAbortable(url);
  }
}
