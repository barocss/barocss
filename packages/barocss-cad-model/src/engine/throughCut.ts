import { CadNumericPolicy, CadPartLimits, checkOutput, evaluateCadPart, type CadPartFeature } from '@barocss/cad';
import type { DocPlane, StudioDoc } from './doc';
import { refusal } from './refusal';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const before = (value: unknown, index: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < index;

export function throughCutPlane(plane: unknown): boolean {
  if (plane === undefined) return true;
  return record(plane) && Array.isArray(plane.origin) && plane.origin.length === 3 && plane.origin.every(Number.isFinite)
    && Array.isArray(plane.normal) && plane.normal.length === 3 && plane.normal[0] === 0 && plane.normal[1] === 0
    && (plane.normal[2] === 1 || plane.normal[2] === -1);
}

export function throughCutSide(nearestDepth: number): boolean {
  return nearestDepth >= -CadNumericPolicy.linearTolerance;
}

/** Check marked cutters at file ingress and before lowering a document prefix. */
export function throughCutProblem(input: unknown): string | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    const nodes = doc.nodes;
    if (Array.isArray(nodes)) for (const [index, tool] of nodes.entries()) {
      if (!record(tool) || !Object.hasOwn(tool, 'cutDepth')) continue;
      if (tool.kind !== 'extrude' || tool.cutDepth !== 'through' || !before(tool.sketch, index)
        || typeof tool.height !== 'number' || !Number.isFinite(tool.height) || tool.height <= 0
        || tool.height > CadPartLimits.length || tool.from !== -tool.height
        || (tool.draft !== undefined && tool.draft !== 0) || tool.made !== undefined)
        return 'The saved Through all cutter has an invalid depth or start.';
      const sketch = nodes[tool.sketch], on = record(sketch) ? sketch.on : undefined;
      if (!record(sketch) || sketch.kind !== 'sketch' || sketch.association !== undefined
        || !throughCutPlane(sketch.plane) || !record(on) || !before(on.node, tool.sketch) || on.side !== 'solid')
        return 'Through all requires a sketch attached to an earlier solid.';
      if (nodes.some(cut => record(cut) && cut.kind === 'difference' && record(cut.tool) && cut.tool.node === index
        && (cut.tool.side !== 'solid' || !record(cut.parent) || cut.parent.node !== on.node || cut.parent.side !== on.side)))
        return 'The Difference must cut the attached solid with this Through all cutter.';
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}

/** The current upright solid supplies exact axial extrema through its native prism vertices. */
export function throughCutHeight(doc: StudioDoc, prefix: readonly CadPartFeature[], target: string, plane: DocPlane | undefined): number {
  if (!throughCutPlane(plane)) throw refusal('VALUE', 'Through all requires a vertical sketch normal.');
  const result = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] });
  const outputs = result.outputs.filter(output => output.id === target);
  if (outputs.length !== 1 || outputs[0].representation !== 'upright' || outputs[0].bodyCount !== 1
    || outputs[0].brep.bodies[0]?.kind !== 'solid' || !checkOutput(outputs[0]).valid)
    throw refusal('BAD_REFERENCE', 'Through all requires one current upright solid.');
  const z = plane?.origin[2] ?? 0, direction = plane?.normal[2] ?? 1;
  let far = -Infinity, near = Infinity;
  for (const vertex of outputs[0].brep.vertices) {
    const depth = (z - vertex.point[2]) * direction;
    far = Math.max(far, depth);
    near = Math.min(near, depth);
  }
  if (!throughCutSide(near)) throw refusal('VALUE', 'Through all target crosses above the sketch plane.');
  const height = Math.ceil(far) + 1;
  if (!Number.isFinite(height) || far <= CadNumericPolicy.linearTolerance || height > CadPartLimits.length)
    throw refusal('VALUE', 'Through all target is outside the supported depth.');
  return height;
}
