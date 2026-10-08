import {
  BufferAttribute, BufferGeometry, DoubleSide, FileLoader, Float32BufferAttribute,
  Group, Line, LineBasicMaterial, Loader, Mesh, MeshNormalMaterial,
} from 'three';
import type { LoadingManager } from 'three';
import { parseBaroCadSource } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadThreeResult extends BaroCadNativeResult {
  /** Surface Mesh and optional Curve Line children. Dispose each child's geometry and material. */
  group: Group;
  /** Idempotent. Releases adapter-owned objects, never a caller Scene. */
  dispose(): void;
}

/** Three.js adapter for original BaroCAD @model text, not for glTF/GLB. */
export class BaroCADLoader extends Loader {
  private readonly options: BaroCadParseOptions;

  constructor(options: BaroCadParseOptions, manager?: LoadingManager) {
    super(manager);
    this.options = options;
  }

  parse(source: string): BaroCadThreeResult {
    const native = parseBaroCadSource(source, this.options);
    const group = new Group();
    group.name = native.model.name;
    const geometries: BufferGeometry[] = [];
    const materials: Array<MeshNormalMaterial | LineBasicMaterial> = [];
    try {
      for (const surface of native.surfaces) {
        const geometry = new BufferGeometry();
        geometries.push(geometry);
        geometry.setAttribute('position', new Float32BufferAttribute(surface.mesh.positions, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(surface.mesh.normals, 3));
        // These are native NURBS parameters. They are not texture UV coordinates.
        geometry.setAttribute('_CAD_UV', new Float32BufferAttribute(surface.mesh.parameters, 2));
        geometry.setIndex(new BufferAttribute(surface.mesh.indices, 1));
        const material = new MeshNormalMaterial({ side: DoubleSide });
        materials.push(material);
        const child = new Mesh(geometry, material);
        child.name = surface.surfaceId;
        child.userData = { surfaceId: surface.surfaceId, revision: surface.mesh.revision };
        group.add(child);
      }
      for (const curve of native.curves) {
        const geometry = new BufferGeometry();
        geometries.push(geometry);
        geometry.setAttribute('position', new Float32BufferAttribute(curve.positions, 3));
        const material = new LineBasicMaterial({ color: 0x28c9eb });
        materials.push(material);
        const child = new Line(geometry, material);
        child.name = curve.curveId;
        child.userData = { barocss: {
          role: 'curve-display-line', modelName: native.model.name,
          curveId: curve.curveId, sourceVersion: 0, lengthUnit: 'mm',
          coordinateSystem: 'right-handed-y-up',
          nativeParameters: [...curve.sample.parameters],
          nativeIntervals: curve.sample.segments.map(segment => [...segment.domain]),
          sampleReport: curve.sample.report,
        } };
        group.add(child);
      }
      const sourceOrder = new Map(native.model.objects.map((object, index) => [object.id, index]));
      group.children.sort((left, right) => (sourceOrder.get(left.name) ?? -1) - (sourceOrder.get(right.name) ?? -1));
    } catch (error) {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
      throw error;
    }
    let disposed = false;
    return { ...native, group, dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    } };
  }

  /** Explicit bounded URL transport. Existing Loader.load/loadAsync behavior is unchanged. */
  async loadAbortable(url: string, transport: BaroCadLoadTransportOptions): Promise<BaroCadThreeResult> {
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadThreeResult | undefined;
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

  load(
    url: string,
    onLoad: (result: BaroCadThreeResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const file = new FileLoader(this.manager);
    file.setPath(this.path);
    file.setRequestHeader(this.requestHeader);
    file.setWithCredentials(this.withCredentials);
    file.load(url, data => {
      let result: BaroCadThreeResult;
      try {
        if (typeof data !== 'string') throw new TypeError('BaroCAD source must be UTF-8 text');
        result = this.parse(data);
      } catch (error) {
        this.manager.itemError(this.path + url);
        onError?.(error);
        return;
      }
      onLoad(result);
    }, onProgress, onError);
  }
}
