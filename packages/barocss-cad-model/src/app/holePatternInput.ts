import type { ModelNode } from '../engine/doc';

export function holeRowSpacingProblem(step: readonly [number, number], diameter: number): string | undefined {
  if (!step.every(Number.isFinite)) return 'Enter finite coordinates for the row step.';
  if (!(Math.hypot(...step) > diameter))
    return 'The row step must be longer than the hole diameter. Increase the step or reduce the diameter.';
}

export function holeRowEditProblem(before: ModelNode, after: ModelNode, parameters: Record<string, number>): string | undefined {
  if (before.kind !== 'hole' || after.kind !== 'hole') return;
  const prior = before.pattern, next = after.pattern;
  if (!prior || !next || !('step' in prior) || !('step' in next) || next.count <= 1) return;
  if (before.radius === after.radius && prior.step[0] === next.step[0] && prior.step[1] === next.step[1]
    && prior.count === next.count) return;
  const radius = typeof after.radius === 'number' ? after.radius : parameters[after.radius.parameter];
  return holeRowSpacingProblem(next.step, 2 * radius);
}
