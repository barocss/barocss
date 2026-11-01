import { solveOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/profile.ts';
import { rectilinearConflict } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/conflict.ts';
type P2 = [number, number];
const RECT: P2[] = [[0, 0], [60, 0], [60, 30], [0, 30]], Z = [0, 0, 0, 0], HV = { h: [0, 2], v: [1, 3] };
const show = (label: string, f: () => unknown) => { try { console.log(label, JSON.stringify(f())); } catch (e) { console.log(label, 'THROWS', String(e).slice(0, 140)); } };
// 1. extreme binary64 values in a 2-point free system: fix p1 at v vs fix p0 at 0, dx 0-1 = |v| (consistent) and |v|+delta
const two: P2[] = [[0, 0], [1, 1]];
for (const v of [5e-324, -5e-324, 2.2250738585072014e-308, -0, 1e-300, 1e300, 1.7976931348623157e308, -1.7976931348623157e308]) {
  show(`fix p1 at ${v}, dx=|v|:`, () => rectilinearConflict(two, { hv: { h: [], v: [] }, rules: [{ kind: 'fix', point: 0, at: [0, 0] }, { kind: 'fix', point: 1, at: [v, 1] }, { kind: 'dx', a: 0, b: 1, value: Math.abs(v) }] }, [0, 0]));
}
show('huge mismatch 1e300 vs 0:', () => rectilinearConflict(two, { hv: { h: [], v: [] }, rules: [{ kind: 'fix', point: 1, at: [1e300, 1] }, { kind: 'dx', a: 0, b: 1, value: 0 }] }, [0, 0]));
// 2. class gate variants
show('circles []:', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, circles: [] }, Z));
show('tangents []:', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, tangents: [] }, Z));
show('tangents [1] on straight (kernel skips it):', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, tangents: [1] }, Z));
show('equalRadii [[0,2]] on straight (kernel skips):', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, equalRadii: [[0, 2]] }, Z));
show('radii {0:5} on straight (kernel skips):', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, radii: { 0: 5 } }, Z));
show('rule parallel out of range (kernel skips):', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, rules: [{ kind: 'parallel', a: 9, b: 10 }] }, Z));
show('edge in both h and v with length:', () => rectilinearConflict(RECT, { hv: { h: [0, 2], v: [0, 1, 3] }, lengths: { 0: 60 } }, Z));
show('bulges NaN:', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 } }, [NaN, 0, 0, 0]));
// 3. inputs the kernel refers to by string id: odd length keys / indices
for (const key of ['2.0', '-0', ' 2', '0x2', '2e0']) {
  const lengths = { 0: 60, [key]: 50 } as unknown as Record<number, number>;
  show(`length key ${JSON.stringify(key)} proof:`, () => rectilinearConflict(RECT, { hv: HV, lengths }, Z));
  show(`length key ${JSON.stringify(key)} solveOutline:`, () => solveOutline(RECT, { hv: HV, lengths }));
}
show('hv with 1.5 solveOutline:', () => solveOutline(RECT, { hv: { h: [0, 2, 1.5], v: [1, 3] }, lengths: { 0: 60, 2: 50 } }));
show('rule dx a=0.5 solveOutline:', () => solveOutline(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, rules: [{ kind: 'dx', a: 0.5, b: 2, value: 3 }] }));
show('rule fix point 1.5 proof:', () => rectilinearConflict(RECT, { hv: HV, lengths: { 0: 60, 2: 50 }, rules: [{ kind: 'fix', point: 1.5, at: [1, 1] }] }, Z));
show('dup h entries solveOutline:', () => solveOutline(RECT, { hv: { h: [0, 0, 2], v: [1, 3] }, lengths: { 0: 60, 2: 50 } }));
show('fix rule on p0 elsewhere (kernel conflict w/ anchor):', () => solveOutline(RECT, { hv: HV, rules: [{ kind: 'fix', point: 0, at: [1, 0] }] }));
show('fix rule on p0 3e-7 off:', () => [solveOutline(RECT, { hv: HV, rules: [{ kind: 'fix', point: 0, at: [3e-7, 0] }] }).ok, rectilinearConflict(RECT, { hv: HV, rules: [{ kind: 'fix', point: 0, at: [3e-7, 0] }] }, Z)]);
show('negative length:', () => [solveOutline(RECT, { hv: HV, lengths: { 0: -60 } }), rectilinearConflict(RECT, { hv: HV, lengths: { 0: -60 } }, Z)]);
show('dx value 0.0005 (< kernel min):', () => [solveOutline(RECT, { hv: HV, rules: [{ kind: 'dx', a: 0, b: 2, value: 0.0005 }] }), rectilinearConflict(RECT, { hv: HV, rules: [{ kind: 'dx', a: 0, b: 2, value: 0.0005 }] }, Z)]);
