import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { DRAW_MODES } from 'pixi.js';
import { parseBaroCadSource, validateBaroCadParseOptions } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadPixi3DResult extends BaroCadNativeResult {
  /** Owned display root. Original CAD identity is in model and renderedSurfaces. */
  root: Container3D;
  renderedSurfaces: ReadonlyArray<Readonly<{ surfaceId: string; mesh: Mesh3D }>>;
  /** Explicit sample-v1 Curve display only. IDs and parameters name the loaded output source. */
  renderedCurves: ReadonlyArray<Readonly<{
    curveId: string;
    mesh: Mesh3D;
    nativeParameters: ReadonlyArray<number>;
    nativeIntervals: ReadonlyArray<readonly [number, number]>;
    sampleReport: BaroCadNativeResult['curves'][number]['sample']['report'];
  }>>;
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

/** Pixi3D 2.5.0 / PixiJS 7.2.4 native source0 Surface and explicit v1 Curve display. */
export class BaroCADPixi3DLoader {
  constructor(private readonly options: BaroCadParseOptions) {}

  parse(source: string): BaroCadPixi3DResult {
    const options = validateBaroCadParseOptions(this.options);
    if (options.curveDisplay !== undefined && !('version' in options.curveDisplay)) {
      throw new RangeError('BaroCAD Pixi3D requires explicit curveDisplay version 1');
    }
    const native = parseBaroCadSource(source, options);
    const root = new Container3D();
    const owned: Mesh3D[] = [];
    const renderedSurfaces: Array<Readonly<{ surfaceId: string; mesh: Mesh3D }>> = [];
    const renderedCurves: Array<BaroCadPixi3DResult['renderedCurves'][number]> = [];
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
      for (const curve of native.curves) {
        const geometry = new MeshGeometry3D();
        let material: StandardMaterial | undefined;
        let mesh: Mesh3D | undefined;
        try {
          const positions = Float32Array.from(curve.positions);
          const count = positions.length / 3;
          if (!Number.isInteger(count) || count < 2 || count > 4093) {
            throw new RangeError('BaroCAD Pixi3D Curve display exceeds v1 point bounds');
          }
          geometry.positions = {
            buffer: positions, componentType: 5126, componentCount: 3,
            normalized: false, ...limits(positions),
          };
          // Unlit Pixi3D shader input. This is not a native Curve normal.
          const shaderNormals = new Float32Array(positions.length);
          for (let index = 2; index < shaderNormals.length; index += 3) shaderNormals[index] = 1;
          geometry.normals = {
            buffer: shaderNormals, componentType: 5126, componentCount: 3, normalized: false,
          };
          geometry.indices = {
            buffer: Uint16Array.from({ length: count }, (_, index) => index),
            componentType: 5123, componentCount: 1, normalized: false,
          };
          material = new StandardMaterial();
          material.unlit = true;
          material.doubleSided = true;
          material.baseColor = new Color(0.16, 0.79, 0.92);
          material.drawMode = DRAW_MODES.LINE_STRIP;
          mesh = new Mesh3D(geometry, material);
          owned.push(mesh);
          root.addChild(mesh);
          renderedCurves.push(Object.freeze({
            curveId: curve.curveId, mesh,
            nativeParameters: Object.freeze([...curve.sample.parameters]),
            nativeIntervals: Object.freeze(curve.sample.segments.map(segment =>
              Object.freeze([...segment.domain] as [number, number]))),
            sampleReport: structuredClone(curve.sample.report),
          }));
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
      renderedCurves: Object.freeze(renderedCurves),
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
