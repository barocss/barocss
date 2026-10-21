import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { treeOfDoc } from '@barocss/cad-model/chat/robot';
import { forwardKinematics, type Motion } from '@barocss/cad-model/robot/fk';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { IK_ANGLE_TOL_RAD, IK_POSITION_TOL_M, jacobianConditioning, solveIk, unknownsOf, pathTo } from '@barocss/cad-model/robot/ik';

// RM7 (O43): damped least squares / LM inverse kinematics. 1000 targets on RM5's 6R arm, reachable by construction (RM2's
// FK of random joint values), each solved from 0 and judged by RM2's FK on the answer — not by the solver's own error:
// at least 990 within 1e-4 m and 1e-3 rad. The singularity flag at the arm straight up and a 2R stretched; an
// unreachable target never a success.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function arm(): Promise<JointTree> {
  const r = await readStudioFile(new Uint8Array(readFileSync(join(CASES, 'arm-6r', 'robot.bcad')))); assert.ok('doc' in r);
  const e = await evaluate(r.doc); assert.ok(e.ok);
  const tree = await treeOfDoc(r.doc, e.bodies, evaluate); assert.equal(unknownsOf(pathTo(tree, 'l6')).length, 6); return tree;
}
let state = 0x2545f491;
const rand = () => { state = (state + 0x6d2b79f5) >>> 0; let x = Math.imul(state ^ (state >>> 15), 1 | state); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
/** The oracle: RM2's FK at q, the tool point (mm) and the end link's rotation. */
function pose(tree: JointTree, link: string, tool: readonly number[], q: Readonly<Record<string, number>>): { x: number[]; R: Float64Array; m: Motion } {
  const m = forwardKinematics(tree, q).motions.get(link)!;
  return { x: [0, 1, 2].map(i => m.R[i * 3] * tool[0] + m.R[i * 3 + 1] * tool[1] + m.R[i * 3 + 2] * tool[2] + m.t[i]), R: m.R, m };
}
function angleBetween(A: Float64Array, B: Float64Array): number {
  let tr = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tr += A[i * 3 + j] * B[i * 3 + j];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
}

test('1000 reachable targets on the 6R arm: at least 990 reached within 1e-4 m and 1e-3 rad by the oracle FK', async () => {
  const tree = await arm(), keys = unknownsOf(pathTo(tree, 'l6')), j6 = tree.joints.find(j => j.child === 'l6')!;
  // (The tool point: 80 mm up l6's axis from its joint, the block's far end.)
  const tool = [0, 1, 2].map(i => j6.origin[i] + 80 * j6.axis[i]);
  let ok = 0, worstM = 0, worstRad = 0, iters = 0, flagged = 0; const misses: string[] = [];
  for (let k = 0; k < 1000; k++) {
    const qt = Object.fromEntries(keys.map(key => [key, (rand() * 2 - 1) * Math.PI])), want = pose(tree, 'l6', tool, qt);
    const r = solveIk(tree, { link: 'l6', motion: want.m, tool });
    const got = pose(tree, 'l6', tool, r.q), em = Math.hypot(got.x[0] - want.x[0], got.x[1] - want.x[1], got.x[2] - want.x[2]) / 1000, er = angleBetween(got.R, want.R);
    // (The solver's own claim agrees with the oracle's reading.)
    assert.equal(r.reached, em <= IK_POSITION_TOL_M && er <= IK_ANGLE_TOL_RAD, `${k}: claimed ${r.reached} at ${em} m, ${er} rad`);
    if (em <= IK_POSITION_TOL_M && er <= IK_ANGLE_TOL_RAD) { ok++; worstM = Math.max(worstM, em); worstRad = Math.max(worstRad, er); } else misses.push(`${k}: ${em.toExponential(2)} m ${er.toExponential(2)} rad`);
    iters += r.iterations; if (r.singular) flagged++;
  }
  console.log(`RM7: ${ok}/1000 reached; worst ${worstM.toExponential(2)} m, ${worstRad.toExponential(2)} rad; ${(iters / 1000).toFixed(1)} iterations a target; ${flagged} flagged singular; misses ${misses.slice(0, 5).join('; ')}`);
  assert.ok(ok >= 990, `${ok}/1000: ${misses.slice(0, 10).join('; ')}`);
  assert.ok(flagged <= 20, `${flagged} random targets flagged singular`);
});

test('the singularity flag: the arm straight up (q = 0) reached and flagged — nothing moves the tip along the arm; a 2R stretched flagged; an unreachable target never a success', async () => {
  const tree = await arm(), j6 = tree.joints.find(j => j.child === 'l6')!, tool = [0, 1, 2].map(i => j6.origin[i] + 80 * j6.axis[i]);
  const up = pose(tree, 'l6', tool, {}), r = solveIk(tree, { link: 'l6', motion: up.m, tool }, { [unknownsOf(pathTo(tree, 'l6'))[1]]: 0.3 });
  assert.equal(r.reached, true, JSON.stringify(r)); assert.equal(r.singular, true, `σ ${r.sigmaMin} / ${r.sigmaMax}`);
  assert.equal(jacobianConditioning(tree, 'l6', {}, tool).singular, true);
  // (Bent, the same arm is well-conditioned.)
  const bent = Object.fromEntries(unknownsOf(pathTo(tree, 'l6')).map((k, i) => [k, 0.4 + 0.3 * i]));
  assert.equal(jacobianConditioning(tree, 'l6', bent, tool).singular, false);
  // (A planar 2R, links 100 and 60 mm on Z axes, for its tool point's position: stretched, singular; bent, not.)
  const chain: JointTree = { version: 1, base: 'base', links: [{ id: 'base', part: 'base', name: 'base' }, { id: 'a', part: 'a', name: 'a' }, { id: 'b', part: 'b', name: 'b' }], loops: [], couplings: [], problems: [], notes: [],
    joints: [{ key: 'base~a', type: 'continuous', parent: 'base', child: 'a', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] }, { key: 'a~b', type: 'continuous', parent: 'a', child: 'b', origin: [100, 0, 0], axis: [0, 0, 1], mates: [] }] };
  assert.equal(jacobianConditioning(chain, 'b', {}, [160, 0, 0], 'position').singular, true);
  assert.equal(jacobianConditioning(chain, 'b', { 'a~b': 1 }, [160, 0, 0], 'position').singular, false);
  const s2 = solveIk(chain, { link: 'b', motion: { R: Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), t: new Float64Array(3) }, tool: [160, 0, 0], mode: 'position' }, { 'a~b': 0.5 });
  assert.deepEqual([s2.reached, s2.singular], [true, true], JSON.stringify(s2));
  // (Past its reach: 200 mm out. Not reached, its best error said.)
  const far: Motion = { R: Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), t: Float64Array.of(40, 0, 0) };
  const u = solveIk(chain, { link: 'b', motion: far, tool: [160, 0, 0], mode: 'position' });
  assert.equal(u.reached, false); assert.ok(u.errorM > 0.03, String(u.errorM));
});
