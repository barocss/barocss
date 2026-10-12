/** Package-private authored arithmetic; no owner handles, native geometry or evaluation frames. */
export type ModelDimension = number | { parameter: string }
  | { op: 'add'; left: ModelDimension; right: ModelDimension }
  | { op: 'scale'; value: ModelDimension; factor: number };
export const ModelDimensionLimits = Object.freeze({ nodes: 32, depth: 6, lengthMM: 10000 });
export class ModelDimensionError extends Error {
  constructor(readonly code: 'INPUT' | 'PARAMETER' | 'BUDGET', detail: string) { super(detail); this.name = 'ModelDimensionError'; }
}
function check(value: unknown, code: ModelDimensionError['code'], detail: string): asserts value {
  if (!value) throw new ModelDimensionError(code, detail);
}
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Own dimension record required');
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'INPUT', 'Plain dimension record required');
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(value);
  check(actual.length === keys.length && keys.every(key => Object.hasOwn(descriptors, key) && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable), 'INPUT', 'Exact own dimension fields required: ' + keys.join(', '));
  return value as Record<string, unknown>;
}
/** Validate each occurrence, then resolve left-to-right/postorder without reassociation. */
export function resolveModelDimension(input: unknown, parameters: Readonly<Record<string, number>>): number {
  let nodes = 0;
  const length = (value: unknown): number => {
    check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= ModelDimensionLimits.lengthMM, 'PARAMETER', 'Every dimension intermediate must be finite within +/-10000 mm');
    return value;
  };
  const visit = (value: unknown, depth: number): number => {
    check(++nodes <= ModelDimensionLimits.nodes && depth <= ModelDimensionLimits.depth, 'BUDGET', 'Dimension exceeds 32 nodes or depth 6');
    if (typeof value === 'number') return length(value);
    // Inspect descriptors first; untrusted getters and symbols are never executed.
    check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Length literal, parameter or owned arithmetic record required');
    if (Object.hasOwn(value, 'parameter')) {
      const record = fields(value, ['parameter']), key = record.parameter;
      check(typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(key) && !['__proto__','prototype','constructor'].includes(key), 'INPUT', 'Safe parameter name required');
      const descriptor = Object.getOwnPropertyDescriptor(parameters, key);
      check(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'PARAMETER', 'Unknown parameter: ' + key);
      return length(descriptor.value);
    }
    const op = Object.getOwnPropertyDescriptor(value, 'op');
    check(op && Object.hasOwn(op, 'value') && op.enumerable, 'INPUT', 'Own dimension operation required');
    if (op.value === 'add') {
      const record = fields(value, ['op','left','right']);
      const left = visit(record.left, depth + 1), right = visit(record.right, depth + 1);
      return length(left + right);
    }
    check(op.value === 'scale', 'INPUT', 'Only add and scale dimension operations are supported');
    const record = fields(value, ['op','value','factor']);
    check(typeof record.factor === 'number' && Number.isFinite(record.factor), 'PARAMETER', 'Finite dimensionless numeric scale required');
    const operand = visit(record.value, depth + 1);
    return length(operand * record.factor);
  };
  return visit(input, 1);
}
