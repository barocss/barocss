import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial } from 'three';
import { parseBaroCadUniformCurveSource, validateBaroCadUniformCurveSourceOptions } from './native-uniform-curve.js';
import type { BaroCadUniformCurveSourceOptions, BaroCadUniformCurveSourceResult } from './native-uniform-curve.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadUniformCurveSourceOptions } from './native-uniform-curve.js';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadUniformCurveThreeResult extends BaroCadUniformCurveSourceResult {
  /** Detached adapter-owned group containing exactly one original uniform display Line. */
  readonly group: Group;
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  /** Detach and release owned geometry/material once. Original native CPU data remain readable. */
  dispose(): void;
}

/** Explicit uniform source0 Curve adapter. This plain class does not inherit Three FileLoader behavior. */
export class BaroCADUniformCurveLoader {
  readonly #options: BaroCadUniformCurveSourceOptions;

  constructor(options: BaroCadUniformCurveSourceOptions) {
    this.#options = validateBaroCadUniformCurveSourceOptions(options);
  }

  parse(source: string): BaroCadUniformCurveThreeResult {
    const native = parseBaroCadUniformCurveSource(source, this.#options);
    let geometry: BufferGeometry | undefined;
    let material: LineBasicMaterial | undefined;
    let group: Group | undefined;
    let line: Line<BufferGeometry, LineBasicMaterial> | undefined;
    try {
      geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(native.positions, 3));
      material = new LineBasicMaterial({ color: 0x28c9eb });
      line = new Line(geometry, material);
      line.name = native.curveId;
      line.userData = { barocss: {
        role: 'uniform-curve-display-line', modelName: native.model.name, curveId: native.curveId,
        sourceVersion: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up',
        mode: native.mode, nativeParameters: [...native.parameters],
        nativeIntervals: native.intervals.map(interval => [...interval]), quality: { ...native.quality },
      } };
      group = new Group();
      group.name = native.model.name;
      group.add(line);
    } catch (error) {
      line?.removeFromParent();
      group?.removeFromParent();
      group?.clear();
      geometry?.dispose();
      material?.dispose();
      throw error;
    }
    // Capture only resources that actually completed construction; caller replacements are not owned.
    const ownedGeometry = geometry, ownedMaterial = material, ownedGroup = group, ownedLine = line;
    let disposed = false;
    return { ...native, group: ownedGroup, line: ownedLine, dispose() {
      if (disposed) return;
      disposed = true;
      ownedLine.removeFromParent();
      ownedGroup.removeFromParent();
      ownedGroup.clear();
      ownedGeometry.dispose();
      ownedMaterial.dispose();
    } };
  }

  /** Read bounded original UTF-8 source; abort and progress follow the shared source transport contract. */
  async loadAsync(url: string, transport: BaroCadLoadTransportOptions = {}): Promise<BaroCadUniformCurveThreeResult> {
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadUniformCurveThreeResult | undefined;
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
