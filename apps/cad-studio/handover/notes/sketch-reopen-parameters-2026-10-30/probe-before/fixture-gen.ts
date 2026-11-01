import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { writeFileSync } from 'node:fs';
const doc: any = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { W: 60 }, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' },
  { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const v: any = await evaluateDoc(doc); console.log('ok', v.ok, 'volume', v.ok ? v.bodies[0].volume : v.error);
if (v.ok && Math.abs(v.bodies[0].volume - 24000) < 1e-6) { writeFileSync('/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/test/fixtures/d356.bcad', JSON.stringify(doc, null, 2) + '\n'); console.log('written'); }
