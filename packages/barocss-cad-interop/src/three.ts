import {
  BufferAttribute, BufferGeometry, DoubleSide, FileLoader, Float32BufferAttribute,
  Group, Line, LineBasicMaterial, Loader, Mesh, MeshNormalMaterial, Vector3,
} from 'three';
import type { Intersection, LoadingManager } from 'three';
import { makeCurvePickBinding, readAffineMatrix, readOwnData, readPoint, resolveCurveChord, sameValues } from './curve-pick.js';
import type { BaroCadCurveDisplayPick, CurvePickBinding } from './curve-pick.js';
import { parseBaroCadSource } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadCurveDisplayPick } from './curve-pick.js';

interface ThreeCurvePickEntry {
  binding: CurvePickBinding;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  attribute: Float32BufferAttribute;
  geometryDisposed: boolean;
}

const curvePickResults = new WeakMap<BaroCadThreeResult, {
  owned: Map<Mesh | Line, ThreeCurvePickEntry | null>;
  isDisposed: () => boolean;
}>();

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
    const owned = new Map<Mesh | Line, ThreeCurvePickEntry | null>();
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
        owned.set(child, null);
      }
      for (const curve of native.curves) {
        const geometry = new BufferGeometry();
        geometries.push(geometry);
        const attribute = new Float32BufferAttribute(curve.positions, 3);
        geometry.setAttribute('position', attribute);
        const material = new LineBasicMaterial({ color: 0x28c9eb });
        materials.push(material);
        const child = new Line(geometry, material);
        child.name = curve.curveId;
        child.userData = { barocss: {
          role: 'curve-display-line', modelName: native.model.name,
          curveId: curve.curveId, sourceVersion: 0, lengthUnit: 'mm',
          coordinateSystem: 'right-handed-z-up',
          nativeParameters: [...curve.sample.parameters],
          nativeIntervals: curve.sample.segments.map(segment => [...segment.domain]),
          sampleReport: curve.sample.report,
        } };
        group.add(child);
        const original = native.model.objects.find(object => object.kind === 'curve' && object.id === curve.curveId);
        if (!original || original.kind !== 'curve') throw new RangeError('BaroCAD Curve display lost its native source binding');
        const entry: ThreeCurvePickEntry = {
          binding: makeCurvePickBinding(native.model.name, original, curve),
          geometry, material, attribute, geometryDisposed: false,
        };
        geometry.addEventListener('dispose', () => { entry.geometryDisposed = true; });
        owned.set(child, entry);
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
    const result: BaroCadThreeResult = { ...native, group, dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      owned.clear();
    } };
    curvePickResults.set(result, { owned, isDisposed: () => disposed });
    return result;
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

/** Associate one actual Three Line hit with its accepted native Curve sample interval. */
export function resolveBaroCadThreeCurvePick(
  result: BaroCadThreeResult, intersection: Intersection | null,
): BaroCadCurveDisplayPick | null {
  const record = curvePickResults.get(result);
  if (!record) throw new TypeError('BaroCAD Three pick requires a result from this loader');
  if (record.isDisposed()) throw new RangeError('BaroCAD Three pick result is disposed');
  if (intersection === null) return null;
  const object = readOwnData(intersection, 'object');
  if (!(object instanceof Line || object instanceof Mesh) || !record.owned.has(object)) {
    throw new RangeError('BaroCAD Three pick object is foreign to this result');
  }
  const entry = record.owned.get(object);
  if (!entry) return null;
  if (!(object instanceof Line) || object.parent !== result.group || entry.geometryDisposed ||
      object.geometry !== entry.geometry || object.material !== entry.material ||
      object.geometry.index !== null || object.geometry.getAttribute('position') !== entry.attribute ||
      !sameValues(entry.attribute.array, entry.binding.positions)) {
    throw new RangeError('BaroCAD Three Curve display geometry is stale');
  }
  const index = readOwnData(intersection, 'index');
  if (typeof index !== 'number' || !Number.isInteger(index) ||
      index < object.geometry.drawRange.start ||
      index + 1 >= object.geometry.drawRange.start + object.geometry.drawRange.count) {
    throw new RangeError('BaroCAD Three Curve segment index is stale');
  }
  const point = readOwnData(intersection, 'point');
  if (!(point instanceof Vector3)) throw new TypeError('BaroCAD Three pick point must be a Vector3');
  const worldHit = readPoint(
    readOwnData(point, 'x') as number, readOwnData(point, 'y') as number, readOwnData(point, 'z') as number,
  );
  object.updateWorldMatrix(true, false);
  const matrix = readAffineMatrix(readOwnData(object.matrixWorld, 'elements'));
  return resolveCurveChord('three', entry.binding, index, worldHit, matrix, 1e-5 * Math.max(1, Math.hypot(...worldHit)));
}
