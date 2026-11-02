/** Test-only source transform and cold normal velocity bridge. */
import { createHash } from 'node:crypto';
import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import type { Body, Vec3 as MutableVec3 } from '../../packages/barocss-physics/src/types.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { solveNormalContacts } from './candidate.js';
import type { NormalProblem, NormalSolverResult, NormalBody, Mat3, Vec3 } from './candidate.js';

export const ORIGINAL_GLOBAL_ISLAND_SHA256 = '670f5226576cb0a2c1963705b99704be71d4ebd3ad38c312adf9c16d43781d8d';
const START = '  /** Initialize every point, warm every eligible patch, then solve globally. */';
const END = '  /** Fresh geometry for position-only correction; no new velocity/cache rows. */';
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
export interface GlobalIslandTransformReceipt {
  inputSha256: string; outputSha256: string; replacedBlockSha256: string;
  inputBytes: number; outputBytes: number; replacedBlockBytes: number;
  startAnchorCount: number; endAnchorCount: number; helperImport: string;
  changedRegion: 'entire velocity solve including warm start';
}
export function transformGlobalIslandSource(source: string, adapterModulePath: string): {
  contents: string; receipt: GlobalIslandTransformReceipt;
} {
  if (hash(source) !== ORIGINAL_GLOBAL_ISLAND_SHA256) throw new Error('NORMAL_ADAPTER_ORIGINAL_SOURCE_HASH');
  const startCount = source.split(START).length-1, endCount = source.split(END).length-1;
  if (startCount !== 1 || endCount !== 1) throw new Error('NORMAL_ADAPTER_SOURCE_ANCHOR_COUNT');
  if (!adapterModulePath.startsWith('/') || !adapterModulePath.endsWith('/world-adapter.ts')) {
    throw new Error('NORMAL_ADAPTER_ABSOLUTE_MODULE_REQUIRED');
  }
  const start = source.indexOf(START), end = source.indexOf(END);
  if (end <= start) throw new Error('NORMAL_ADAPTER_SOURCE_ANCHOR_ORDER');
  const replaced = source.slice(start, end);
  const replacement = `  /** Experimental cold coupled normal solve; no old warm starts or sweeps. */
  solve(): void {
    this.#requirePhase('assembled');
    const cold = solveFrozenNormalIsland(this.#bodies, this.#patches);
    for (const [key, impulse] of cold.pointsMap) this.#pointsMap.set(key, impulse);
    this.#pointLedger.push(...cold.pointLedger);
    this.#warmStats.coldPoints = cold.pointLedger.length;
    this.#phase = 'solved';
  }

`;
  const helperImport = `import { solveFrozenNormalIsland } from ${JSON.stringify(adapterModulePath)};\n`;
  const contents = helperImport + source.slice(0, start) + replacement + source.slice(end);
  return { contents, receipt: { inputSha256: hash(source), outputSha256: hash(contents),
    replacedBlockSha256: hash(replaced), inputBytes: Buffer.byteLength(source), outputBytes: Buffer.byteLength(contents),
    replacedBlockBytes: Buffer.byteLength(replaced), startAnchorCount: startCount, endAnchorCount: endCount,
    helperImport, changedRegion: 'entire velocity solve including warm start' } };
}

export interface NormalIslandPatch {
  aIndex: number; bIndex: number; aId: string; bId: string; pairKey: string;
  family: 'face' | 'edge'; normal: MutableVec3;
  points: readonly { id: string; pointM: MutableVec3 }[];
}
export interface NormalIslandPointMapping {
  index: number; candidateId: string; pairKey: string; pointId: string;
  aId: string; bId: string; family: 'face' | 'edge';
}
/** Structural reporting DTO; no import of the old position solver type graph. */
export interface AdapterPointLedger {
  aId: string; bId: string; aIndex: number; bIndex: number; pairKey: string;
  pointId: string; family: 'face' | 'edge'; pointM: MutableVec3; normal: MutableVec3;
  aPositionM: MutableVec3; bPositionM: MutableVec3; warm: PointImpulse; final: PointImpulse;
}
export interface NormalIslandEvent {
  attemptOrdinal: number; problem: NormalProblem | null; candidate: NormalSolverResult | null;
  assembledPointCount: number; assembledPatchCount: number;
  pointMapping: NormalIslandPointMapping[]; velocitySolveAccepted: boolean;
  refusal: { code: string; message: string } | null;
}
let observer: ((event: NormalIslandEvent) => void) | null = null;
let attemptOrdinal = 0;
export function setNormalIslandObserver(callback: ((event: NormalIslandEvent) => void) | null): void {
  observer = callback; attemptOrdinal = 0;
}
function notify(event: NormalIslandEvent): void { observer?.(structuredClone(event)); }
function requireProfile(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PhysicsError('NUMERIC_LIMIT', 'private cold normal adapter: ' + message);
}
function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
function admittedBody(body: Body): NormalBody {
  requireProfile(body.frictionStatic === 1 && body.frictionDynamic === .7 && body.restitution === 0, 'original material required');
  requireProfile(body.shape.kind === 'box' && !body.sensor && !body.ccd, 'original unsensed boxes required');
  let inverseInertiaWorld: Mat3;
  if (body.kind === 'dynamic') {
    requireProfile(body.inverseMass === 1 && same(body.shape.halfExtentsM, [.25, .25, .25]) &&
      same(body.inverseInertiaLocal, [24, 24, 24]), 'one-kilogram isotropic24I cubes required');
    inverseInertiaWorld = [[24, 0, 0], [0, 24, 0], [0, 0, 24]];
  } else {
    requireProfile(body.kind === 'static' && body.inverseMass === 0 && same(body.inverseInertiaLocal, [0, 0, 0]) &&
      same(body.velocityMps, [0, 0, 0]) && same(body.angularVelocityRadps, [0, 0, 0]) &&
      same(body.shape.halfExtentsM, [2, .1, 2]) && same(body.positionM, [0, -.1, 0]) &&
      same(body.orientation, [0, 0, 0, 1]), 'original static floor required');
    inverseInertiaWorld = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  }
  return { id: body.id, positionM: [...body.positionM], velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps], inverseMass: body.inverseMass, inverseInertiaWorld };
}
function pointVelocity(body: NormalBody, point: Vec3): [number, number, number] {
  const r = point.map((value, i) => value-body.positionM[i]), w = body.angularVelocityRadps;
  return [body.velocityMps[0]+w[1]*r[2]-w[2]*r[1], body.velocityMps[1]+w[2]*r[0]-w[0]*r[2],
    body.velocityMps[2]+w[0]*r[1]-w[1]*r[0]];
}
function enforceTangentFeasibility(problem: NormalProblem, result: NormalSolverResult): void {
  requireProfile(result.ok && result.status === 'SOLVED_NORMAL_ONLY' && result.normalImpulsesNs &&
    result.rowResiduals && result.certificate, 'candidate did not return solved normal rows');
  requireProfile(result.normalImpulsesNs.length === problem.points.length && result.rowResiduals.length === problem.points.length &&
    result.bodies.length === problem.bodies.length, 'candidate count mismatch');
  requireProfile(result.certificate.zeroTangentFeasible && result.certificate.maxLoadedTangentSpeedMps <= 1e-10,
    'loaded tangent speed exceeds1e-10m/s');
  const ids = new Map(result.bodies.map(body => [body.id, body]));
  for (let i = 0; i < problem.points.length; i++) {
    const point = problem.points[i], lambda = result.normalImpulsesNs[i];
    requireProfile(Number.isFinite(lambda) && lambda >= 0, 'invalid normal impulse');
    if (lambda === 0) continue;
    const a = ids.get(point.aId), b = ids.get(point.bId);
    requireProfile(a && b, 'candidate endpoint mismatch');
    const va = pointVelocity(a, point.pointM), vb = pointVelocity(b, point.pointM);
    const relative = vb.map((value, k) => value-va[k]);
    const vn = relative.reduce((sum, value, k) => sum+value*point.normalAtoB[k], 0);
    const tangent = relative.map((value, k) => value-vn*point.normalAtoB[k]);
    requireProfile(Math.hypot(...tangent) <= 1e-10 && result.rowResiduals[i].tangentSpeedMps <= 1e-10,
      'independent loaded tangent speed exceeds1e-10m/s');
  }
}

/** One cold call. The caller owns the uncommitted World working-body array. */
export function solveFrozenNormalIsland(bodies: Body[], patches: readonly NormalIslandPatch[]): {
  pointsMap: Map<string, PointImpulse>; pointLedger: AdapterPointLedger[];
} {
  const ordinal = ++attemptOrdinal;
  const assembledPointCount = patches.reduce((count, patch) => count + patch.points.length, 0);
  const assembledPatchCount = patches.length;
  let problem: NormalProblem | null = null, candidate: NormalSolverResult | null = null;
  const pointMapping: NormalIslandPointMapping[] = [];
  let pointsMap: Map<string, PointImpulse>, pointLedger: AdapterPointLedger[];
  try {
    requireProfile(bodies.length === 9 && bodies.filter(body => body.kind === 'dynamic').length === 8 &&
      bodies.filter(body => body.kind === 'static').length === 1, 'original eight-box body profile required');
    requireProfile(assembledPointCount <= 32, 'more than32actual points');
    const inputBodies = bodies.map(admittedBody);
    const points: NormalProblem['points'][number][] = [];
    for (const patch of patches) {
      requireProfile(bodies[patch.aIndex]?.id === patch.aId && bodies[patch.bIndex]?.id === patch.bId &&
        patch.aIndex !== patch.bIndex && patch.pairKey === patch.aId+'\0'+patch.bId, 'source patch identity');
      for (const point of patch.points) {
        const candidateId = JSON.stringify([patch.pairKey, point.id]);
        pointMapping.push({ index: points.length, candidateId, pairKey: patch.pairKey, pointId: point.id,
          aId: patch.aId, bId: patch.bId, family: patch.family });
        points.push({ id: candidateId, aId: patch.aId, bId: patch.bId, pointM: [...point.pointM], normalAtoB: [...patch.normal] });
      }
    }
    problem = { bodies: inputBodies, points };
    candidate = solveNormalContacts(problem);
    if (!candidate.ok) throw new PhysicsError(candidate.status === 'ITERATION_LIMIT' ? 'ITERATION_LIMIT' : 'NUMERIC_LIMIT',
      'private cold normal candidate: '+candidate.reason);
    enforceTangentFeasibility(problem, candidate);
    candidate.bodies.forEach((body, i) => requireProfile(body.id === bodies[i].id && same(body.positionM, bodies[i].positionM),
      'candidate body order or pose changed'));
    pointsMap = new Map(); pointLedger = [];
    for (let i = 0; i < pointMapping.length; i++) {
      const mapping = pointMapping[i], point = points[i], normalNs = candidate.normalImpulsesNs![i];
      const aIndex = bodies.findIndex(body => body.id === mapping.aId), bIndex = bodies.findIndex(body => body.id === mapping.bId);
      const final: PointImpulse = { normalNs, tangentNs: [0, 0, 0] };
      pointsMap.set(mapping.pairKey+'\0'+mapping.pointId, { normalNs, tangentNs: [0, 0, 0] });
      pointLedger.push({ aId: mapping.aId, bId: mapping.bId, aIndex, bIndex, pairKey: mapping.pairKey,
        pointId: mapping.pointId, family: mapping.family, pointM: [...point.pointM], normal: [...point.normalAtoB],
        aPositionM: [...bodies[aIndex].positionM], bPositionM: [...bodies[bIndex].positionM],
        warm: { normalNs: 0, tangentNs: [0, 0, 0] }, final });
    }
    requireProfile(pointsMap.size === points.length && pointLedger.length === points.length, 'source point keys collided');
  } catch (error) {
    notify({ attemptOrdinal: ordinal, assembledPointCount, assembledPatchCount, problem, candidate, pointMapping, velocitySolveAccepted: false,
      refusal: error instanceof PhysicsError ? { code: error.code, message: error.message } : { code: 'UNKNOWN', message: 'unexpected adapter error' } });
    throw error;
  }
  notify({ attemptOrdinal: ordinal, assembledPointCount, assembledPatchCount, problem, candidate, pointMapping, velocitySolveAccepted: true, refusal: null });
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].velocityMps = [...candidate!.bodies[i].velocityMps];
    bodies[i].angularVelocityRadps = [...candidate!.bodies[i].angularVelocityRadps];
  }
  return { pointsMap, pointLedger };
}
