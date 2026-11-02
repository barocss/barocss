import test from 'node:test';
import assert from 'node:assert/strict';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import type { TimedPath } from '@barocss/cad-model/robot/ccd';
import { checkPath, duration, poseAt } from '@barocss/cad-model/robot/motion';
import { BarocssError } from '@barocss/cad-model/engine/refusal';

// Reproducer contract, frozen before baseline execution:
// - nonfinite waypoint/time and unsupported profile: VALUE;
// - malformed/nonfinite supplied rates: LIMITS_BAD;
// - checkPath returns Problems; duration/poseAt throw typed refusals.
// These codes match existing high-level RobotPath finite-input boundaries.
// Missing or nonpositive required rates retain LIMITS_MISSING.
// This does not cover mutation of an already cached path object.
const tree: JointTree = {
  version: 1, base: 'base',
  links: ['base', 'tool'].map(id => ({ id, name: id, part: id })),
  joints: [{ key: 'slide', type: 'prismatic', parent: 'base', child: 'tool',
    origin: [137, -83, 29], axis: [1, 0, 0], limit: { lower: -20, upper: 80 }, mates: [] }],
  loops: [], couplings: [], problems: [], notes: [],
};
const validPath = (): TimedPath => ({
  waypoints: [{ slide: 0 }, { slide: 10 }], profile: 'trapezoid', limits: { slide: { v: 20, a: 40 } },
});
const typed = (code: string) => (error: unknown) =>
  error instanceof BarocssError && error.code === code && error.message.startsWith(`[${code}]`);
function refuses(path: TimedPath, code: string): void {
  const problems = checkPath(tree, path);
  assert.ok(problems.length > 0, `expected ${code}, got no problems`);
  assert.equal(problems[0].code, code);
  assert.throws(() => duration(path), typed(code));
  assert.throws(() => poseAt(tree, path, 0.25), typed(code));
}

for (const [name, value] of [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity]] as const) {
  for (const index of [0, 1]) test(`motion input: ${name} waypoint ${index} is a VALUE refusal`, () => {
    const path = validPath();
    const points = path.waypoints.map(w => ({ ...w }));
    points[index].slide = value;
    refuses({ ...path, waypoints: points }, 'VALUE');
  });
  test(`motion input: ${name} query time is a VALUE refusal before and after cache use`, () => {
    const path = validPath();
    assert.throws(() => poseAt(tree, path, value), typed('VALUE'));
    assert.ok(Number.isFinite(poseAt(tree, path, 0.25).slide));
    assert.throws(() => poseAt(tree, path, value), typed('VALUE'));
  });
  for (const field of ['v', 'a', 'j'] as const) test(`motion input: supplied ${field}=${name} is a LIMITS_BAD refusal`, () => {
    const path = validPath();
    refuses({ ...path, limits: { slide: { v: 20, a: 40, j: 80, [field]: value } } }, 'LIMITS_BAD');
  });
}

test('motion input: unsupported timing profile is a VALUE refusal', () => {
  refuses({ ...validPath(), profile: 'cubic' } as unknown as TimedPath, 'VALUE');
});

for (const [name, limits] of [
  ['null limits', null], ['array limits', []], ['null joint rates', { slide: null }],
  ['array joint rates', { slide: [] }], ['scalar joint rates', { slide: 20 }],
] as const) test(`motion input: ${name} is a LIMITS_BAD refusal`, () => {
  refuses({ ...validPath(), limits } as unknown as TimedPath, 'LIMITS_BAD');
});

test('motion input: finite valid and absent/nonpositive required rate behavior remains bounded', () => {
  assert.deepEqual(checkPath(tree, validPath()), []);
  assert.equal(duration(validPath()), 1);
  assert.equal(poseAt(tree, validPath(), -1).slide, 0);
  assert.equal(poseAt(tree, validPath(), 2).slide, 10);
  const limitCases: TimedPath['limits'][] = [{}, { slide: { v: 0, a: 40 } }, { slide: { v: 20, a: -1 } }];
  for (const limits of limitCases) {
    refuses({ ...validPath(), limits }, 'LIMITS_MISSING');
  }
});
