import { CadNumericPolicy } from '@barocss/cad';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { featureLabel, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureId } from '@barocss/cad-model/engine/ids';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';

type Hole = Extract<ModelNode, { kind: 'hole' }>;
type Result = { nodes: ModelNode[] } | { error: FriendlyError };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const numericPair = (value: readonly [unknown, unknown]): value is readonly [number, number] =>
  finite(value[0]) && finite(value[1]);

function refused(hint: string): Result {
  return { error: { title: 'Pattern spacing not changed', hint, detail: '' } };
}

/** Check numbered Hole dependencies and move a proven complete bore with a spacing edit. */
export function prepareLinearPatternHoleEdit(doc: StudioDoc, draft: ModelNode[], index: number): Result {
  const pattern = doc.nodes[index], next = draft[index];
  if (pattern?.kind !== 'linear-pattern' || next?.kind !== 'linear-pattern') return { nodes: draft };
  if (pattern.spacing === next.spacing && pattern.count === next.count) return { nodes: draft };
  const dependents = doc.nodes.flatMap((node, at) => {
    if (node.kind !== 'hole' || node.suppressed || node.held || node.parent.node !== index || !node.face) return [];
    const match = /^(.*)@(\d+)$/.exec(node.face);
    if (!match) return [];
    const copy = Number(match[2]);
    return Number.isSafeInteger(copy) && copy > 0 ? [{ hole: node, at, seed: match[1], copy }] : [];
  });
  if (!dependents.length) return { nodes: draft };
  if (Number.isSafeInteger(next.count) && next.count > 0 && next.count < pattern.count) {
    const retiring = dependents.filter(dependent => dependent.copy >= next.count);
    if (retiring.length) {
      const minimum = Math.max(...retiring.map(dependent => dependent.copy)) + 1;
      const impacted = retiring.map(({ hole, at, copy }) =>
        `Count ${next.count} removes copy ${copy + 1}, used by ${featureLabel(hole, at, doc.nodes)} (${featureId(doc.nodes, at)}) on ${hole.face}.`);
      return { error: {
        title: 'Pattern count not changed',
        hint: `${impacted.join(' ')} Keep at least ${minimum} copies, or suppress the affected Hole before changing Count.`,
        detail: '',
      } };
    }
  }
  if (pattern.spacing === next.spacing) return { nodes: draft };

  const [{ hole, seed, copy }] = dependents;
  const stock = doc.nodes[pattern.parent.node];
  const sketch = stock?.kind === 'extrude' ? doc.nodes[stock.sketch] : undefined;
  if (dependents.length !== 1 || hole !== doc.nodes.at(-1) || hole.made
    || hole.pattern || hole.depth !== undefined || hole.countersink !== undefined || hole.csk !== undefined || hole.thread !== undefined
    || (hole.axis ?? 'z') !== 'z' || hole.side === 'min' || hole.parent.side !== 'solid'
    || pattern.suppressed || pattern.held || pattern.parent.side !== 'solid' || pattern.axis === 'z'
    || next.axis !== pattern.axis || next.count !== pattern.count || next.parent !== pattern.parent
    || stock?.kind !== 'extrude' || stock.suppressed || stock.held || (stock.draft ?? 0) !== 0
    || !finite(stock.height) || stock.height <= 0
    || sketch?.kind !== 'sketch' || sketch.suppressed || sketch.held || sketch.profile !== 'rectangle'
    || sketch.on || sketch.association || sketch.outline || sketch.regions?.length || sketch.holes?.length
    || (sketch.plane && !isDefaultPlane(sketch.plane))) {
    return refused('This Hole cannot follow a spacing edit. Keep the spacing or edit the Hole and pattern separately.');
  }

  const axis = pattern.axis === 'x' ? 0 : 1;
  const pitches = [pattern.spacing, next.spacing], { min, max } = sketch;
  const centre = hole.center, radius = hole.radius;
  if (seed !== featureId(doc.nodes, pattern.parent.node) + '.top'
    || copy >= pattern.count
    || !numericPair(min) || !numericPair(max) || !numericPair(centre) || !finite(radius) || radius <= 0
    || !pitches.every(finite)) {
    return refused('The Hole needs a unique numbered top face and numeric dimensions to follow this edit.');
  }
  if (max[0] <= min[0] || max[1] <= min[1]) return refused('The stock rectangle needs positive dimensions.');
  const [oldPitch, newPitch] = pitches;
  const { linearTolerance, coordinateAbs } = CadNumericPolicy;
  // Keep the kernel's separation margin above rounding of translated corners and the cutter rim.
  const clearance = 4 * linearTolerance;
  const inRange = (value: number) => Math.abs(value) <= coordinateAbs;
  if (!pitches.every(pitch => [min[axis] + (pattern.count - 1) * pitch, max[axis] + (pattern.count - 1) * pitch].every(inRange))
    || ![...min, ...max].every(inRange)) {
    return refused('Keep all pattern copies within the modelling coordinate range.');
  }
  if (pitches.some(pitch => Math.abs(pitch) - (max[axis] - min[axis]) <= clearance)) {
    return refused('Keep a gap between pattern copies so the Hole stays on the selected copy.');
  }
  const containsBore = (point: readonly number[], pitch: number) => point.every((value, k) => {
    const offset = k === axis ? copy * pitch : 0;
    return value - (min[k] + offset) > radius + clearance && (max[k] + offset) - value > radius + clearance;
  });
  if (!containsBore(centre, oldPitch)) {
    return refused('The existing Hole crosses or touches the selected copy boundary. Move its centre inside that copy before editing spacing.');
  }
  const moved: [number, number] = [centre[0], centre[1]];
  moved[axis] = centre[axis] - copy * oldPitch + copy * newPitch;
  if (!containsBore(moved, newPitch)) {
    return refused('The moved Hole crosses or touches the selected copy boundary. Choose a spacing that preserves the bore.');
  }
  return { nodes: draft.map((node, i) => i === doc.nodes.length - 1 ? { ...hole, center: moved } : node) };
}
