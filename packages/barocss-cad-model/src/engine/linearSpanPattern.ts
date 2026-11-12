import { CadPartLimits } from '@barocss/cad';
import { NODE_EXTRA_FIELDS, type ModelNode } from './doc';

const fields = new Set(['kind', 'parent', 'axis', 'span', 'count']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
type Input = { spacing: number } | { code: 'VALUE' | 'BAD_REFERENCE'; message: string };
export type LinearPatternNode = Extract<ModelNode, { kind: 'linear-pattern' | 'linear-span-pattern' }>;
export type LinearPatternDistanceMode = 'spacing' | 'span';

export function convertLinearPatternDistance(node: LinearPatternNode, mode: LinearPatternDistanceMode, index: number):
  { node: LinearPatternNode } | { message: string } {
  if (node.kind === 'linear-pattern') {
    if (mode === 'spacing') return { node };
    const { spacing, ...rest } = node;
    if (typeof spacing !== 'number') return { message: 'Unbind Spacing before switching to Total span.' };
    const next = { ...rest, kind: 'linear-span-pattern', span: spacing * (node.count - 1) } as const;
    const result = linearSpanPatternInput(next, index);
    return 'code' in result ? result : { node: next };
  }
  if (mode === 'span') return { node };
  const { span, ...rest } = node;
  const result = linearSpanPatternInput({ ...rest, span }, index);
  if ('code' in result) return result;
  return { node: { ...rest, kind: 'linear-pattern', spacing: result.spacing } };
}

/** Total span is the only authored distance. Reuse the native pitch and copy limits. */
export function linearSpanPatternInput(node: Record<string, unknown>, index: number, maxCount: number = CadPartLimits.copies): Input {
  if (Object.keys(node).some(key => !fields.has(key) && !(NODE_EXTRA_FIELDS as readonly string[]).includes(key))) {
    return { code: 'VALUE', message: 'Linear pattern total span has an unknown field.' };
  }
  const { parent, axis, span, count } = node;
  if (!record(parent) || Object.keys(parent).some(key => key !== 'node' && key !== 'side')
    || typeof parent.node !== 'number' || !Number.isInteger(parent.node) || parent.node < 0 || parent.node >= index
    || typeof parent.side !== 'string' || !/^(solid|negative|positive|instance[123]|part\d+)$/.test(parent.side)) {
    return { code: 'BAD_REFERENCE', message: 'Linear pattern total span needs a preceding body.' };
  }
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return { code: 'VALUE', message: 'Linear pattern total span needs direction X, Y or Z.' };
  return linearSpanSpacing(span, count, maxCount);
}

export function linearSpanSpacing(span: unknown, count: unknown, maxCount: number = CadPartLimits.copies): Input {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 2 || count > maxCount) {
    return { code: 'VALUE', message: `Linear pattern total span requires a whole-number Count from 2 to ${maxCount}.` };
  }
  if (typeof span !== 'number' || !Number.isFinite(span) || span <= 0) return { code: 'VALUE', message: 'Total span must be a finite positive distance.' };
  const spacing = span / (count - 1);
  if (spacing <= 0 || spacing > CadPartLimits.length) {
    return { code: 'VALUE', message: `Derived spacing must be positive and at most ${CadPartLimits.length} mm.` };
  }
  return { spacing };
}

/** Check stored recipes, including suppressed and nested source definitions, before evaluation. */
export function linearSpanPatternProblem(input: unknown): Extract<Input, { code: string }> | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) for (const [index, node] of doc.nodes.entries()) {
      if (!record(node) || node.kind !== 'linear-span-pattern') continue;
      const result = linearSpanPatternInput(node, index);
      if ('code' in result) return result;
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}
