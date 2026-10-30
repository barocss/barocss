// Rectilinear contradictions that are NOT reported as a proven Conflict (docs sketches.md line ~77 says they are).
import { solveOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/profile.ts';
import { commitDimension, type Polygon } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/rules.ts';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/settle.ts';
type P2 = [number, number];
const RECT: P2[] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const r = (x: any) => x.ok ? 'ok' : `${x.conflict ? '[conflict] ' : ''}${x.reason.slice(0, 90)}`;
console.log('A band: lengths 60 / 60+6e-7      ->', r(solveOutline(RECT, { lengths: { 0: 60, 2: 60 + 6e-7 } })));
console.log('B mixed: lengths 60/50 + equal(1,3)->', r(solveOutline(RECT, { lengths: { 0: 60, 2: 50 }, rules: [{ kind: 'equal', a: 1, b: 3 }] })));
console.log('C mixed: lengths 60/50 + perpendicular(0,1) ->', r(solveOutline(RECT, { lengths: { 0: 60, 2: 50 }, rules: [{ kind: 'perpendicular', a: 0, b: 1 }] })));
// D: through the studio's commit path, an outline with an arc elsewhere plus the rectangle-style conflict
const close = (pts: P2[], bulges: number[]) => { const s = { kind: 'polygon', closed: true, points: pts, bulges } as unknown as Polygon; return settleShape(s, { ...s, closed: false }).shape as Polygon; };
const shapeD = close([[0, 0], [60, 0], [60, 30], [30, 30], [0, 30]], [0, 0, 0, 0.3, 0]);
let d: any = commitDimension(shapeD, 'len0', 60); if (d.ok) d = commitDimension(d.shape, 'len2', 50);
console.log('D arc elsewhere: len0 60, then len2 50 (commitDimension) ->', r(d));
