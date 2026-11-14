import type { Dim, ModelNode } from '../engine/doc';

export function holeRowSpacingProblem(step: readonly [number, number], diameter: number): string | undefined {
  if (!step.every(Number.isFinite)) return 'Enter finite coordinates for the row step.';
  if (!(Math.hypot(...step) > diameter))
    return 'The row step must be longer than the hole diameter. Increase the step or reduce the diameter.';
}

export function holeCircleCentreProblem(first: readonly number[], about: readonly number[]): string | undefined {
  if (![...first, ...about].every(Number.isFinite)) return 'Enter finite coordinates for the circle centre and first hole.';
  if (Math.hypot(first[0] - about[0], first[1] - about[1]) < 1e-6)
    return 'Put the first hole away from the circle centre so the copies can turn around it.';
}

export function holePatternEditProblem(before: ModelNode, after: ModelNode, parameters: Record<string, number>): string | undefined {
  if (before.kind !== 'hole' || after.kind !== 'hole') return;
  const prior = before.pattern, next = after.pattern;
  if (!prior || !next || next.count <= 1) return;
  const value = (dimension: Dim) => typeof dimension === 'number' ? dimension : parameters[dimension.parameter];
  if ('step' in prior && 'step' in next) {
    if (before.radius === after.radius && prior.step[0] === next.step[0] && prior.step[1] === next.step[1]
      && prior.count === next.count) return;
    return holeRowSpacingProblem(next.step, 2 * value(after.radius));
  }
  if ('about' in prior && 'about' in next) {
    if (before.center[0] === after.center[0] && before.center[1] === after.center[1] && prior.about[0] === next.about[0]
      && prior.about[1] === next.about[1] && prior.count === next.count) return;
    return holeCircleCentreProblem(after.center.map(value), next.about);
  }
}
