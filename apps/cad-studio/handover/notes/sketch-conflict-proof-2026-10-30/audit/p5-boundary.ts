// Discriminating exactness check: the exact feasibility boundary B = 3·d(0.1) + 4·d(4e-7) of a dx chain; the largest double ≤ B
// must be feasible and the next double up must be proven.
import { rectilinearConflict } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/conflict.ts';
type P2 = [number, number];
function rat(v: number): [bigint, bigint] { let q = 1n, x = v; while (!Number.isInteger(x)) { x *= 2; q *= 2n; } return [BigInt(x), q]; }
const D = 1n << 200n, toD = (v: number) => { const [p, q] = rat(v); return p * (D / q); };
const B = 3n * toD(0.1) + 4n * toD(4 * 1e-7);
const f64 = new Float64Array(1), u = new BigUint64Array(f64.buffer); const next = (x: number) => { f64[0] = x; u[0] += 1n; return f64[0]; };
const prev = (x: number) => { f64[0] = x; u[0] -= 1n; return f64[0]; };
let lo = Number(B) / Number(D), g = 0; while (toD(lo) > B && g++ < 64) lo = prev(lo); while (toD(next(lo)) <= B && g++ < 128) lo = next(lo); const hi = next(lo);
const four: P2[] = [[0, 0], [1, 3], [2, 6], [3, 9]];
const chain = (target: number) => rectilinearConflict(four, { hv: { h: [], v: [] }, rules: [{ kind: 'fix', point: 0, at: [0, 0] }, { kind: 'dx', a: 0, b: 1, value: 0.1 }, { kind: 'dx', a: 1, b: 2, value: 0.1 }, { kind: 'dx', a: 2, b: 3, value: 0.1 }, { kind: 'dx', a: 0, b: 3, value: target }] }, [0, 0, 0, 0]);
console.log('lo(≤B)', lo, JSON.stringify(chain(lo)), 'hi(>B)', hi, JSON.stringify(chain(hi)), 'B==lo exactly', toD(lo) === B);
