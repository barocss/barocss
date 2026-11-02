/** Private normal-only contact candidate. No World, geometry or fixture imports. */
export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];
export interface NormalBody {
  id: string; positionM: Vec3; velocityMps: Vec3; angularVelocityRadps: Vec3;
  inverseMass: number; inverseInertiaWorld: Mat3;
}
export interface NormalPoint { id: string; aId: string; bId: string; pointM: Vec3; normalAtoB: Vec3 }
export interface NormalProblem { bodies: readonly NormalBody[]; points: readonly NormalPoint[] }
export interface NormalRowResidual {
  id: string; normalSpeedMps: number; negativeNormalImpulseNs: number;
  complementarityJ: number; tangentSpeedMps: number;
}
export interface NormalCertificate {
  maxClosingNormalSpeedMps: number; maxNegativeNormalImpulseNs: number;
  maxComplementarityJ: number; maxStationaritySqrtJ: number;
  maxLoadedTangentSpeedMps: number; zeroTangentFeasible: boolean;
}
export interface NormalSolverStats {
  outerIterations: number; blockQrFactorizations: number; activeChanges: number;
  qrRank: number; finalActiveRows: number; dynamicDof: number; rankTests: number;
  dotProducts: number; dotScalarProducts: number; vectorUpdates: number;
  triangularTerms: number; constraintTests: number;
}
export interface NormalSolverResult {
  ok: boolean; status: 'SOLVED_NORMAL_ONLY' | 'NUMERIC' | 'ITERATION_LIMIT';
  bodies: NormalBody[]; normalImpulsesNs: number[] | null;
  rowResiduals: NormalRowResidual[] | null; certificate: NormalCertificate | null;
  stats: NormalSolverStats; reason: string | null;
}

export const NORMAL_CANDIDATE_GATES = Object.freeze({ normal: 1e-10, complementarity: 1e-10,
  stationarity: 1e-10, tangent: 1e-10, rank: 1e-12 });
export const NORMAL_CANDIDATE_BUDGET = Object.freeze({ outerIterations: 64, blockQrFactorizations: 64,
  activeChanges: 64, rankTests: 2048, dotProducts: 400000, dotScalarProducts: 32000000,
  vectorUpdates: 10000000, triangularTerms: 40000, constraintTests: 4096 });
type CountKey = keyof typeof NORMAL_CANDIDATE_BUDGET;
class Stop extends Error {
  constructor(readonly status: 'NUMERIC' | 'ITERATION_LIMIT', message: string) { super(message); }
}
function numeric(message: string): never { throw new Stop('NUMERIC', message); }
function need(value: unknown, message: string): asserts value { if (!value) numeric(message); }
function finite(x: number): number { if (!Number.isFinite(x)) numeric('nonfinite arithmetic'); return x; }
function stats(): NormalSolverStats {
  return { outerIterations: 0, blockQrFactorizations: 0, activeChanges: 0, qrRank: 0,
    finalActiveRows: 0, dynamicDof: 0, rankTests: 0, dotProducts: 0,
    dotScalarProducts: 0, vectorUpdates: 0, triangularTerms: 0, constraintTests: 0 };
}
function take(s: NormalSolverStats, key: CountKey, amount = 1): void {
  if (s[key] + amount > NORMAL_CANDIDATE_BUDGET[key]) throw new Stop('ITERATION_LIMIT', 'budget:' + key);
  s[key] += amount;
}
function dot(a: readonly number[], b: readonly number[], s: NormalSolverStats): number {
  take(s, 'dotProducts'); take(s, 'dotScalarProducts', a.length);
  let value = 0;
  for (let i = 0; i < a.length; i++) value = finite(value + finite(a[i] * b[i]));
  return value;
}
function axpy(target: number[], source: readonly number[], amount: number, s: NormalSolverStats): void {
  take(s, 'vectorUpdates', target.length);
  for (let i = 0; i < target.length; i++) target[i] = finite(target[i] + finite(amount * source[i]));
}
function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [finite(a[1]*b[2]-a[2]*b[1]), finite(a[2]*b[0]-a[0]*b[2]), finite(a[0]*b[1]-a[1]*b[0])];
}
function subtract(a: Vec3, b: Vec3): [number, number, number] {
  return [finite(a[0]-b[0]), finite(a[1]-b[1]), finite(a[2]-b[2])];
}
function validVector(v: unknown, limit: number): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && Array.from({ length: 3 }, (_, i) => i)
    .every(i => Object.hasOwn(v, i) && typeof v[i] === 'number' && Number.isFinite(v[i]) && Math.abs(v[i]) <= limit);
}
function copyBody(body: NormalBody): NormalBody {
  return { id: body.id, positionM: [...body.positionM], velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps], inverseMass: body.inverseMass,
    inverseInertiaWorld: body.inverseInertiaWorld.map(row => [...row]) as unknown as Mat3 };
}
function read(value: NormalProblem): NormalProblem {
  need(value && Array.isArray(value.bodies) && value.bodies.length >= 1 && value.bodies.length <= 9 &&
    Array.isArray(value.points) && value.points.length <= 32, 'body/point bound');
  const ids = new Set<string>();
  let dynamic = 0;
  for (const body of value.bodies) {
    need(body && typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 1024 && !ids.has(body.id), 'body id');
    ids.add(body.id);
    need(validVector(body.positionM, 10000) && validVector(body.velocityMps, 1000) &&
      validVector(body.angularVelocityRadps, 1000), 'body vectors');
    need(typeof body.inverseMass === 'number' && Number.isFinite(body.inverseMass) &&
      (body.inverseMass === 0 || body.inverseMass >= 1e-6 && body.inverseMass <= 1e6), 'inverse mass');
    need(Array.isArray(body.inverseInertiaWorld) && body.inverseInertiaWorld.length === 3 &&
      body.inverseInertiaWorld.every((row: unknown) => validVector(row, 1e6)), 'inverse inertia');
    if (body.inverseMass === 0) {
      need([...body.velocityMps, ...body.angularVelocityRadps, ...body.inverseInertiaWorld.flat()].every(x => x === 0),
        'static input must have zero motion and inertia');
    } else dynamic++;
  }
  need(dynamic >= 1 && dynamic <= 8, 'dynamic body bound');
  const pointIds = new Set<string>();
  for (const point of value.points) {
    need(point && typeof point.id === 'string' && point.id.length > 0 && point.id.length <= 4096 &&
      !pointIds.has(point.id), 'point id');
    pointIds.add(point.id);
    need(ids.has(point.aId) && ids.has(point.bId) && point.aId !== point.bId, 'point endpoints');
    need(validVector(point.pointM, 10000) && validVector(point.normalAtoB, 1+1e-12), 'point vectors');
    need(Math.abs(Math.hypot(...point.normalAtoB)-1) <= 1e-12, 'unit normal');
  }
  return { bodies: value.bodies.map(copyBody), points: value.points.map((p): NormalPoint => ({ ...p,
    pointM: [...p.pointM], normalAtoB: [...p.normalAtoB] })) };
}

interface Block { offset: number | null; rootMass: number; angular: number[][] }
interface Model { input: NormalProblem; blocks: Block[]; a: number[][]; free: number[] }
function cholesky(matrix: Mat3, s: NormalSolverStats): number[][] {
  const scale = Math.max(1, ...matrix.flat().map(Math.abs));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) need(matrix[i][j] === matrix[j][i], 'symmetric inertia required');
  const lower = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) {
    let entry = matrix[i][j];
    for (let k = 0; k < j; k++) { take(s, 'triangularTerms'); entry = finite(entry-finite(lower[i][k]*lower[j][k])); }
    if (i === j) { need(entry > 1e-12*scale, 'positive definite well-scaled inertia required'); lower[i][j] = Math.sqrt(entry); }
    else lower[i][j] = finite(entry/lower[j][j]);
  }
  return lower;
}
function model(input: NormalProblem, s: NormalSolverStats): Model {
  const blocks: Block[] = [], free: number[] = [];
  for (const body of input.bodies) {
    if (body.inverseMass === 0) { blocks.push({ offset: null, rootMass: 0, angular: [] }); continue; }
    const angular = cholesky(body.inverseInertiaWorld, s), rootMass = Math.sqrt(body.inverseMass), offset = free.length;
    for (const value of body.velocityMps) free.push(finite(value/rootMass));
    const local = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let value = body.angularVelocityRadps[i];
      for (let j = 0; j < i; j++) { take(s, 'triangularTerms'); value = finite(value-finite(angular[i][j]*local[j])); }
      local[i] = finite(value/angular[i][i]);
    }
    free.push(...local); blocks.push({ offset, rootMass, angular });
  }
  s.dynamicDof = free.length;
  const ids = new Map(input.bodies.map((body, i) => [body.id, i]));
  const a = input.points.map(point => {
    const row = Array<number>(free.length).fill(0);
    let dynamicEndpoint = false;
    for (const [id, sign] of [[point.aId, -1], [point.bId, 1]] as const) {
      const index = ids.get(id)!, body = input.bodies[index], block = blocks[index];
      const arm = subtract(point.pointM, body.positionM);
      need(arm.every(x => Math.abs(x) <= 10), 'contact arm bound');
      if (block.offset === null) continue;
      dynamicEndpoint = true;
      const torque = cross(arm, point.normalAtoB);
      for (let k = 0; k < 3; k++) {
        row[block.offset+k] = finite(sign*point.normalAtoB[k]*block.rootMass);
        row[block.offset+3+k] = finite(sign*dot(torque, block.angular.map(r => r[k]), s));
      }
    }
    need(dynamicEndpoint, 'static/static contact unsupported');
    return row;
  });
  return { input, blocks, a, free };
}

interface Factor { rows: number[]; q: number[][]; lower: number[][] }
/** Rank-revealing row QR, fixed two-pass orthogonalization, no refinement loop. */
function factor(a: number[][], candidates: readonly number[], s: NormalSolverStats): Factor {
  take(s, 'blockQrFactorizations');
  const residual = new Map(candidates.map(i => [i, [...a[i]]]));
  const remaining = [...candidates], rows: number[] = [], q: number[][] = [];
  const scale = Math.max(1, ...candidates.map(i => Math.sqrt(dot(a[i], a[i], s))));
  while (remaining.length) {
    let pivot = remaining[0], square = -1;
    for (const index of remaining) {
      const value = dot(residual.get(index)!, residual.get(index)!, s);
      if (value > square || value === square && index < pivot) { pivot = index; square = value; }
    }
    take(s, 'rankTests');
    if (Math.sqrt(Math.max(0, square)) <= NORMAL_CANDIDATE_GATES.rank*scale) break;
    const direction = [...a[pivot]];
    for (let pass = 0; pass < 2; pass++) for (const basis of q) axpy(direction, basis, -dot(direction, basis, s), s);
    const length = Math.sqrt(dot(direction, direction, s));
    need(length > NORMAL_CANDIDATE_GATES.rank*scale, 'inconsistent rank decision');
    const basis = direction.map(value => finite(value/length));
    for (const prior of q) need(Math.abs(dot(basis, prior, s)) <= 1e-12, 'orthogonality');
    q.push(basis); rows.push(pivot); remaining.splice(remaining.indexOf(pivot), 1);
    for (const index of remaining) for (let pass = 0; pass < 2; pass++) {
      const target = residual.get(index)!;
      axpy(target, basis, -dot(target, basis, s), s);
    }
  }
  const lower = rows.map((index, i) => q.slice(0, i+1).map(basis => dot(a[index], basis, s)));
  return { rows, q, lower };
}
function equality(m: Model, qr: Factor, s: NormalSolverStats): { target: number[]; lambda: number[] } {
  const c = qr.q.map(row => dot(row, m.free, s)), target = [...m.free];
  for (let i = 0; i < qr.q.length; i++) axpy(target, qr.q[i], -c[i], s);
  const lambda = Array<number>(qr.rows.length).fill(0);
  for (let i = lambda.length-1; i >= 0; i--) {
    let value = -c[i];
    for (let j = i+1; j < lambda.length; j++) { take(s, 'triangularTerms'); value = finite(value-finite(qr.lower[j][i]*lambda[j])); }
    lambda[i] = finite(value/qr.lower[i][i]);
  }
  return { target, lambda };
}
function outputBodies(m: Model, x: number[], s: NormalSolverStats): NormalBody[] {
  return m.input.bodies.map((body, index) => {
    const result = copyBody(body), block = m.blocks[index];
    if (block.offset !== null) {
      result.velocityMps = [0, 1, 2].map(k => finite(block.rootMass*x[block.offset!+k])) as [number, number, number];
      result.angularVelocityRadps = block.angular.map(row => dot(row, x.slice(block.offset!+3, block.offset!+6), s)) as [number, number, number];
    }
    return result;
  });
}
function finish(m: Model, x: number[], active: readonly number[], multipliers: number[], s: NormalSolverStats): NormalSolverResult {
  const lambda = Array<number>(m.a.length).fill(0);
  active.forEach((index, i) => { need(multipliers[i] >= -1e-10, 'negative active multiplier'); lambda[index] = Math.max(0, multipliers[i]); });
  const bodies = outputBodies(m, x, s), ids = new Map(bodies.map((body, i) => [body.id, i]));
  const rowResiduals = m.input.points.map((point, i) => {
    take(s, 'constraintTests');
    const velocities = [point.aId, point.bId].map(id => {
      const body = bodies[ids.get(id)!], spin = cross(body.angularVelocityRadps, subtract(point.pointM, body.positionM));
      return body.velocityMps.map((v, k) => finite(v+spin[k])) as [number, number, number];
    });
    const relative = subtract(velocities[1], velocities[0]), vn = dot(relative, point.normalAtoB, s);
    const tangent = relative.map((value, k) => finite(value-point.normalAtoB[k]*vn));
    return { id: point.id, normalSpeedMps: vn, negativeNormalImpulseNs: Math.max(0, -lambda[i]),
      complementarityJ: Math.abs(finite(lambda[i]*vn)), tangentSpeedMps: Math.hypot(...tangent) };
  });
  let stationarity = 0;
  for (let k = 0; k < x.length; k++) {
    const reaction = dot(m.a.map(row => row[k]), lambda, s);
    stationarity = Math.max(stationarity, Math.abs(finite(x[k]-m.free[k]-reaction)));
  }
  const certificate: NormalCertificate = {
    maxClosingNormalSpeedMps: Math.max(0, ...rowResiduals.map(row => -row.normalSpeedMps)),
    maxNegativeNormalImpulseNs: Math.max(0, ...rowResiduals.map(row => row.negativeNormalImpulseNs)),
    maxComplementarityJ: Math.max(0, ...rowResiduals.map(row => row.complementarityJ)),
    maxStationaritySqrtJ: stationarity,
    maxLoadedTangentSpeedMps: Math.max(0, ...rowResiduals.filter((_, i) => lambda[i] > 0).map(row => row.tangentSpeedMps)),
    zeroTangentFeasible: false,
  };
  certificate.zeroTangentFeasible = certificate.maxLoadedTangentSpeedMps <= 1e-10;
  need(certificate.maxClosingNormalSpeedMps <= 1e-10 && certificate.maxNegativeNormalImpulseNs <= 1e-10 &&
    certificate.maxComplementarityJ <= 1e-10 && certificate.maxStationaritySqrtJ <= 1e-10, 'final certificate');
  s.finalActiveRows = active.length;
  return { ok: true, status: 'SOLVED_NORMAL_ONLY', bodies, normalImpulsesNs: [...lambda], rowResiduals,
    certificate, stats: { ...s }, reason: null };
}

/** Solves only homogeneous normal constraints. Tangential impulses are zero. */
export function solveNormalContacts(problem: NormalProblem): NormalSolverResult {
  const s = stats(); let input: NormalProblem | null = null;
  try {
    input = read(problem);
    const m = model(input, s);
    let current = Array<number>(m.free.length).fill(0), active: number[] | null = null;
    for (;;) {
      take(s, 'outerIterations');
      const qr = factor(m.a, active ?? m.a.map((_, i) => i), s);
      if (active === null) s.qrRank = qr.rows.length;
      else need(qr.rows.length === active.length, 'dependent working basis');
      active = [...qr.rows];
      const solved = equality(m, qr, s), direction = solved.target.map((value, i) => finite(value-current[i]));
      const directionNorm = Math.sqrt(dot(direction, direction, s));
      let alpha = 1, blocker: number | null = null;
      if (directionNorm > 1e-12*Math.max(1, Math.sqrt(dot(m.free, m.free, s)))) {
        for (let i = 0; i < m.a.length; i++) {
          take(s, 'constraintTests');
          if (active.includes(i)) continue;
          const margin = dot(m.a[i], current, s), slope = dot(m.a[i], direction, s);
          need(margin >= -1e-10, 'lost feasible iterate');
          if (slope < -1e-12) {
            const step = finite(Math.max(0, margin)/-slope);
            if (step < alpha || step === alpha && step < 1 && (blocker === null || i < blocker)) { alpha = step; blocker = i; }
          }
        }
      }
      if (blocker !== null && alpha < 1) {
        axpy(current, direction, alpha, s); take(s, 'activeChanges'); active.push(blocker); continue;
      }
      current = solved.target;
      let leaving: number | null = null;
      for (let i = 0; i < active.length; i++) if (solved.lambda[i] < -1e-10 &&
        (leaving === null || active[i] < active[leaving])) leaving = i;
      if (leaving !== null) { take(s, 'activeChanges'); active.splice(leaving, 1); continue; }
      return finish(m, current, active, solved.lambda, s);
    }
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    return { ok: false, status: error.status, bodies: input?.bodies.map(copyBody) ?? [],
      normalImpulsesNs: null, rowResiduals: null, certificate: null, stats: { ...s }, reason: error.message };
  }
}
