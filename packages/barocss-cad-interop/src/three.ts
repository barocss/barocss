import {
  BufferAttribute, BufferGeometry, DoubleSide, FileLoader, Float32BufferAttribute,
  Group, Loader, Mesh, MeshNormalMaterial,
} from 'three';
import type { LoadingManager } from 'three';
import { parseBaroCadSource } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';

export interface BaroCadThreeResult extends BaroCadNativeResult {
  /** One child Mesh per supported native surface. Dispose each child's geometry and material. */
  group: Group;
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
    try {
      for (const surface of native.surfaces) {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(surface.mesh.positions, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(surface.mesh.normals, 3));
        // These are native NURBS parameters. They are not texture UV coordinates.
        geometry.setAttribute('_CAD_UV', new Float32BufferAttribute(surface.mesh.parameters, 2));
        geometry.setIndex(new BufferAttribute(surface.mesh.indices, 1));
        const material = new MeshNormalMaterial({ side: DoubleSide });
        const child = new Mesh(geometry, material);
        child.name = surface.surfaceId;
        child.userData = { surfaceId: surface.surfaceId, revision: surface.mesh.revision };
        group.add(child);
      }
    } catch (error) {
      for (const child of group.children) {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      }
      throw error;
    }
    return { ...native, group };
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
