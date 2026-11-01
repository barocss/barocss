// Is the near-straight-arc refusal pre-existing? Close the same fit with the Spline tool (settle against the open shape), current and base outline.
import { splineShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { splineOutline as baseOutline } from './base/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
const fit: P2[] = [[47,0],[5.697561,21.776413],[-30.197561,14.694631],[-30.197561,-14.694631],[6.697561,-23.776413]];
const a = splineShape({ fit, closed: true }); console.log('current: closing settle error =', settleShape(a, { ...a, closed: false }).error);
const o = baseOutline(fit, true), b: any = { kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true };
console.log('base outline: closing settle error =', settleShape(b, { ...b, closed: false }).error);
