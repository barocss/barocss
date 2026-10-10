import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial } from 'three';
import { parseBaroCadSelectedUniformCurveSource, validateBaroCadSelectedUniformCurveSourceOptions } from './native-selected-uniform-curve.js';
import type { BaroCadSelectedUniformCurveSourceOptions, BaroCadSelectedUniformCurveSourceResult } from './native-selected-uniform-curve.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadSelectedUniformCurveSourceOptions, BaroCadSelectedUniformCurveSourceResult } from './native-selected-uniform-curve.js';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadSelectedUniformCurveThreeResult extends BaroCadSelectedUniformCurveSourceResult {
  readonly group: Group;
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  /** Release original owned geometry/material once; caller replacements/children are not destroyed. */
  dispose(): void;
}

/** Display one selected original Curve without extracting or rewriting its complete source Model. */
export class BaroCADSelectedUniformCurveLoader {
  readonly #options: BaroCadSelectedUniformCurveSourceOptions;
  constructor(options: BaroCadSelectedUniformCurveSourceOptions) { this.#options = validateBaroCadSelectedUniformCurveSourceOptions(options); }

  parse(source: string): BaroCadSelectedUniformCurveThreeResult {
    const native = parseBaroCadSelectedUniformCurveSource(source, this.#options);
    let geometry: BufferGeometry | undefined, material: LineBasicMaterial | undefined, group: Group | undefined, line: Line<BufferGeometry, LineBasicMaterial> | undefined;
    try {
      geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(native.positions, 3));
      material = new LineBasicMaterial({ color: 0x28c9eb }); line = new Line(geometry, material); line.name = native.curveId;
      line.userData = { barocss: { role: 'selected-uniform-curve-display-line', sourceVersion: 0, lengthUnit: 'mm', modelName: native.model.name,
        curveId: native.curveId, selectedObjectIndex: native.selectedObjectIndex, unrenderedObjectIds: [...native.unrenderedObjectIds], mode: native.mode,
        nativeParameters: [...native.parameters], nativeIntervals: native.intervals.map(interval => [...interval]), quality: { ...native.quality } } };
      group = new Group(); group.name = native.model.name; group.add(line);
    } catch (error) {
      try {
        try { line?.removeFromParent(); group?.removeFromParent(); group?.clear(); }
        finally { try { geometry?.dispose(); } finally { material?.dispose(); } }
      } catch { /* Preserve the original construction error. */ }
      throw error;
    }
    const ownedGeometry = geometry, ownedMaterial = material, ownedGroup = group, ownedLine = line; let disposed = false;
    return { ...native, group: ownedGroup, line: ownedLine, dispose() {
      if (disposed) return; disposed = true;
      ownedLine.removeFromParent(); ownedGroup.removeFromParent(); ownedGroup.clear();
      try { ownedGeometry.dispose(); } finally { ownedMaterial.dispose(); }
    } };
  }

  async loadAsync(url: string, transport: BaroCadLoadTransportOptions = {}): Promise<BaroCadSelectedUniformCurveThreeResult> {
    const request = validateBaroCadTransport(url, transport), source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal); let result: BaroCadSelectedUniformCurveThreeResult | undefined;
    try { result = this.parse(source); await Promise.resolve(); throwIfBaroCadAborted(request.signal); return result; }
    catch (error) { result?.dispose(); throw error; }
  }
}
