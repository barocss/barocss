import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { copyBody } from '../../packages/barocss-physics/src/validation.js';
import { validateResult } from '../../packages/barocss-physics/src/collision.js';
import { validateFullPairResult } from './full-pair-solver.mjs';
import { ordinaryDense, refuse, mapFullPairError } from './full-pair-rows.js';
import type { FullPairProblem, FullPairResult } from './full-pair-types.js';
import type { Rounding } from './world-types.js';

function same(a: unknown, b: unknown): boolean {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  const ka = Reflect.ownKeys(a), kb = Reflect.ownKeys(b);
  return ka.length === kb.length && ka.every(k => kb.includes(k) && same(Reflect.get(a, k), Reflect.get(b, k)));
}

function vector(value: unknown, size: number): boolean {
  return ordinaryDense(value, size) && value.every(x => typeof x === 'number' && Number.isFinite(x));
}

/** One copied fresh PRE+p operation; static bodies do not perform addition. */
export function applyFullPairTranslationsOnce(preBodies: readonly Body[], problem: FullPairProblem,
  result: FullPairResult): {
    bodies: Body[]; rounding: Rounding[]; applications: 1; worldCreated: false; worldStepped: false;
  } {
  try {
    // This validation is separate from the kernel's counted solve work.
    const checked = validateFullPairResult(problem, result) as FullPairResult;
    if (checked.status !== 'SOLVED' || checked.ok !== true || !ordinaryDense(preBodies) ||
      preBodies.length < 1 || preBodies.length > 9 || problem.bodies.length !== preBodies.length) refuse('RESULT');
    for (let i = 0; i < preBodies.length; i++) {
      const body = preBodies[i];
      if (!body || body.id !== problem.bodies[i].id || body.inverseMass !== problem.bodies[i].inverseMass ||
        !vector(body.positionM, 3) || !vector(body.velocityMps, 3) ||
        !vector(body.orientation, 4) || !vector(body.angularVelocityRadps, 3)) refuse('RESULT');
    }
    validateResult(preBodies as Body[], []);
    const bodies = preBodies.map(copyBody), rounding: Rounding[] = [];
    for (let i = 0; i < preBodies.length; i++) {
      const before = preBodies[i], body = bodies[i], u = checked.translations[i].u;
      if (Math.hypot(...u) > 10 || (before.inverseMass === 0 && !u.every(v => v === 0))) refuse('RESULT');
      const roundedFinalM = before.inverseMass === 0 ? [...before.positionM] as Vec3 :
        before.positionM.map((v, j) => v + u[j]) as Vec3;
      if (!roundedFinalM.every(Number.isFinite)) refuse('RESULT');
      body.positionM = roundedFinalM;
      const actualDeltaM = body.positionM.map((v, j) => v - before.positionM[j]) as Vec3;
      if (before.inverseMass === 0 && (!u.every(v => v === 0) || !same(body, before))) refuse('RESULT');
      if (!same({ ...body, positionM: before.positionM }, before)) refuse('RESULT');
      rounding.push({
        id: body.id, nominalTranslationM: [...u], roundedFinalM: [...roundedFinalM], actualDeltaM,
        nominalActualDeltaDifferenceM: actualDeltaM.map((v, j) => v - u[j]) as Vec3,
        exactRoundedFinalMatch: true, staticPositionAdditionPerformed: false,
        dynamicPositionAdditionPerformed: before.inverseMass > 0,
      });
    }
    validateResult(bodies, []);
    return { bodies: bodies.map(copyBody), rounding: structuredClone(rounding), applications: 1,
      worldCreated: false, worldStepped: false };
  } catch (error) { throw mapFullPairError(error); }
}
