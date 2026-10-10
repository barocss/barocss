import type { Body } from '../../packages/barocss-physics/src/types.js';
import { detect } from '../../packages/barocss-physics/src/collision.js';
import type { PositionProblem } from './linear-adapter.mjs';
import type { PositionPair } from './phase-types.js';
/** Inspect every original sorted pair, including touching; never cap or truncate here. */
export function freshPositionProblem(bodies: readonly Body[], pairs: readonly PositionPair[]): {problem:PositionProblem;tests:number} {
  const problem: PositionProblem = { bodies:bodies.map(b=>({id:b.id,inverseMass:b.inverseMass})), rows:[] };
  let tests=0;
  for (const [aIndex,bIndex] of pairs) {
    tests++;
    const a=bodies[aIndex],b=bodies[bIndex],hit=detect(a,b);
    if (hit) problem.rows.push({aId:a.id,bId:b.id,normal:[...hit.normal],depthM:hit.penetration});
  }
  return {problem,tests};
}
