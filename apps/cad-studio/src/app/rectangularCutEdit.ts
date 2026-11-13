import { CadNumericPolicy, CadPartLimits } from '@barocss/cad';
import { featureLabel, type Dim, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { featureId } from '@barocss/cad-model/engine/ids';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';

function rectangularExtrusion(nodes: readonly ModelNode[], index: number, parameters: StudioDoc['parameters']) {
  const node = nodes[index];
  if (node?.kind !== 'extrude' || node.suppressed || node.held || (node.draft ?? 0) !== 0) return null;
  const sketch = nodes[node.sketch];
  if (sketch?.kind !== 'sketch' || sketch.profile !== 'rectangle' || sketch.suppressed || sketch.held
    || sketch.on || sketch.association || sketch.outline || sketch.regions?.length || sketch.holes?.length
    || (sketch.plane && !isDefaultPlane(sketch.plane))) return null;

  const value = (dim: Dim) => typeof dim === 'number' ? dim : Object.hasOwn(parameters, dim.parameter) ? parameters[dim.parameter] : NaN;
  const z = value(node.from ?? 0), h = value(node.height);
  const min = [value(sketch.min[0]), value(sketch.min[1]), z];
  const max = [value(sketch.max[0]), value(sketch.max[1]), z + h];
  if (![...min, ...max].every(n => Number.isFinite(n) && Math.abs(n) <= CadNumericPolicy.coordinateAbs)
    || !min.every((n, k) => max[k] > n)) return null;
  return { min, max };
}

/** Preserve a working lateral cut pattern when a History edit moves every cutter above or below its stock. */
export function rectangularCutEditProblem(doc: StudioDoc, draft: readonly ModelNode[], index: number): FriendlyError | null {
  if (doc.nodes[index]?.kind !== 'extrude' || draft[index]?.kind !== 'extrude') return null;
  const { nodes, parameters } = doc;
  for (const [at, pattern] of nodes.entries()) {
    if (pattern.kind !== 'rectangular-feature-pattern' || pattern.suppressed || pattern.held || pattern.parent.side !== 'solid'
      || pattern.axis === 'z' || pattern.axis2 === 'z' || pattern.axis === pattern.axis2) continue;
    const difference = nodes[pattern.parent.node];
    if (difference?.kind !== 'difference' || difference.suppressed || difference.held
      || difference.tool.node !== index || difference.tool.side !== 'solid' || difference.parent.side !== 'solid') continue;
    if (draft[at] !== pattern || draft[pattern.parent.node] !== difference) continue;

    const previousStock = rectangularExtrusion(nodes, difference.parent.node, parameters);
    const previousTool = rectangularExtrusion(nodes, index, parameters);
    const stock = rectangularExtrusion(draft, difference.parent.node, parameters);
    const cutter = rectangularExtrusion(draft, index, parameters);
    if (!stock || !cutter || !previousStock || !previousTool) continue;
    if (cutter.min[2] < stock.max[2] && cutter.max[2] > stock.min[2]) continue;

    // The original cut and its copies share Z. Confirm that at least one old cell removed material.
    const first = pattern.axis === 'x' ? 0 : 1;
    const spacing = typeof pattern.spacing === 'number' ? pattern.spacing : parameters[pattern.spacing.parameter];
    const spacing2 = typeof pattern.spacing2 === 'number' ? pattern.spacing2 : parameters[pattern.spacing2.parameter];
    const cells = pattern.count * pattern.count2;
    if (!Number.isSafeInteger(pattern.count) || !Number.isSafeInteger(pattern.count2)
      || pattern.count < 1 || pattern.count2 < 1 || cells > CadPartLimits.copies
      || !Number.isFinite(spacing) || spacing === 0 || !Number.isFinite(spacing2) || spacing2 === 0) continue;
    const last = [0, 0, 0];
    last[first] = (pattern.count - 1) * spacing;
    last[1 - first] = (pattern.count2 - 1) * spacing2;
    if ([previousTool, cutter].some(tool => last.some((offset, k) =>
      Math.max(Math.abs(tool.min[k] + offset), Math.abs(tool.max[k] + offset)) > CadNumericPolicy.coordinateAbs))) continue;
    const tolerance = 4 * CadNumericPolicy.linearTolerance;
    const overlapsStock = (cell: number) => {
      const offsets = [0, 0, 0];
      offsets[first] = (cell % pattern.count) * spacing;
      offsets[1 - first] = Math.floor(cell / pattern.count) * spacing2;
      const low = offsets.map((offset, k) => Math.max(previousStock.min[k], previousTool.min[k] + offset));
      const high = offsets.map((offset, k) => Math.min(previousStock.max[k], previousTool.max[k] + offset));
      const extent = high.map((value, k) => value - low[k]);
      // The old arrangement's XY shoelace sum is in world coordinates. Only claim positive area
      // above its floating-point cancellation envelope, even when both overlaps exceed the length tolerance.
      const scale = Math.max(1, ...low.slice(0, 2).map(Math.abs), ...high.slice(0, 2).map(Math.abs));
      const areaRoundoff = 64 * Number.EPSILON * scale * scale;
      return extent.every(value => value > tolerance) && extent[0] * extent[1] > areaRoundoff;
    };
    if (Array.from({ length: cells }, (_, cell) => cell).some(overlapsStock)) return {
      title: 'Cutter edit not applied',
      hint: `${featureLabel(pattern, at, nodes)} (${featureId(nodes, at)}) removes no material. Adjust Start Z or Distance so the cutter overlaps the stock.`,
      detail: '',
    };
  }
  return null;
}
