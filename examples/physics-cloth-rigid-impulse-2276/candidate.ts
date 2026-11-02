/** Private instantaneous reduced plant. No clock, retained state, or package imports. */
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];
export interface ClothContext {
  id: string;
  vertexCount: number;
  pinnedVertexIndices: number[];
}
export interface RigidContext { bodyId: string }
export interface ClothVertexEndpoint {
  kind: 'cloth-vertex';
  clothId: string;
  vertexIndex: number;
}
export interface RigidAnchorEndpoint {
  kind: 'rigid-anchor';
  bodyId: string;
  anchorLocalM: Vec3;
}
export interface PointState {
  endpoint: ClothVertexEndpoint;
  positionM: Vec3;
  velocityMps: Vec3;
  massKg: number;
}
export interface RigidState {
  endpoint: RigidAnchorEndpoint;
  comPositionM: Vec3;
  velocityMps: Vec3;
  angularVelocityRadps: Vec3;
  massKg: number;
  rotationBodyToWorld: Mat3;
  principalInertiaKgM2: Vec3;
}
export interface ImpulseInput {
  clothContext: ClothContext;
  rigidContext: RigidContext;
  point: PointState;
  rigid: RigidState;
}
export interface ImpulseReport {
  pointEndpoint: ClothVertexEndpoint;
  rigidEndpoint: RigidAnchorEndpoint;
  worldAnchorArmM: Vec3;
  pointLinearImpulseNs: Vec3;
  rigidLinearImpulseNs: Vec3;
  rigidAngularImpulseNms: Vec3;
  relativeVelocityBeforeMps: Vec3;
  relativeVelocityAfterMps: Vec3;
  kineticEnergyBeforeJ: number;
  kineticEnergyAfterJ: number;
  dissipatedEnergyJ: number;
}
export interface ImpulseResult extends ImpulseInput { report: ImpulseReport }
export type InvalidInputReason =
  | 'SCHEMA_INVALID' | 'NONFINITE_STATE' | 'ENDPOINT_OWNER_MISMATCH'
  | 'ENDPOINT_INDEX_RANGE' | 'PINNED_ENDPOINT' | 'POINT_MASS_RANGE'
  | 'RIGID_MASS_RANGE' | 'INERTIA_RANGE' | 'COMPONENT_RANGE'
  | 'NONPHYSICAL_INERTIA' | 'NOT_PROPER_ROTATION' | 'ANCHOR_MISMATCH';
export class ImpulseInputError extends Error {
  readonly code = 'INVALID_INPUT';
  constructor(readonly reason: InvalidInputReason) {
    super(reason);
    this.name = 'ImpulseInputError';
  }
}
function refuse(reason: InvalidInputReason): never { throw new ImpulseInputError(reason); }

// Ordinary own data only. Read no accessor while deciding the schema.
function record(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || !keys.every(key => own.includes(key))) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable;
  });
}
function denseArray(value: unknown, length: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length) return false;
  if (Reflect.ownKeys(value).length !== length + 1) return false;
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return false;
  }
  return true;
}
function vector(value: unknown): value is Vec3 {
  return denseArray(value, 3) && value.every(component => typeof component === 'number');
}
function matrix(value: unknown): value is Mat3 {
  return denseArray(value, 3) && value.every(vector);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(value);
}
function copy3(v: Vec3): Vec3 { return [v[0], v[1], v[2]]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function multiply(a: Mat3, v: Vec3): Vec3 { return [dot(a[0], v), dot(a[1], v), dot(a[2], v)]; }
function transposeMultiply(a: Mat3, v: Vec3): Vec3 {
  return [a[0][0] * v[0] + a[1][0] * v[1] + a[2][0] * v[2],
    a[0][1] * v[0] + a[1][1] * v[1] + a[2][1] * v[2],
    a[0][2] * v[0] + a[1][2] * v[1] + a[2][2] * v[2]];
}
function admit(input: unknown): asserts input is ImpulseInput {
  if (!record(input, ['clothContext', 'rigidContext', 'point', 'rigid'])) refuse('SCHEMA_INVALID');
  const c = input.clothContext, owner = input.rigidContext, p = input.point, b = input.rigid;
  if (!record(c, ['id', 'vertexCount', 'pinnedVertexIndices']) || !record(owner, ['bodyId']) ||
      !record(p, ['endpoint', 'positionM', 'velocityMps', 'massKg']) ||
      !record(b, ['endpoint', 'comPositionM', 'velocityMps', 'angularVelocityRadps', 'massKg', 'rotationBodyToWorld', 'principalInertiaKgM2'])) refuse('SCHEMA_INVALID');
  const pe = p.endpoint, be = b.endpoint;
  if (!record(pe, ['kind', 'clothId', 'vertexIndex']) || pe.kind !== 'cloth-vertex' ||
      !record(be, ['kind', 'bodyId', 'anchorLocalM']) || be.kind !== 'rigid-anchor') refuse('SCHEMA_INVALID');
  if (![c.id, owner.bodyId, pe.clothId, be.bodyId].every(identity)) refuse('SCHEMA_INVALID');
  if (typeof c.vertexCount !== 'number' || !Number.isInteger(c.vertexCount) || c.vertexCount < 1 || c.vertexCount > 289 ||
      !Array.isArray(c.pinnedVertexIndices) || c.pinnedVertexIndices.length > 289 ||
      !denseArray(c.pinnedVertexIndices, c.pinnedVertexIndices.length) ||
      !c.pinnedVertexIndices.every(i => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < (c.vertexCount as number)) ||
      new Set(c.pinnedVertexIndices).size !== c.pinnedVertexIndices.length ||
      typeof pe.vertexIndex !== 'number' || !Number.isInteger(pe.vertexIndex)) refuse('SCHEMA_INVALID');
  const vectors = [p.positionM, p.velocityMps, b.comPositionM, b.velocityMps, b.angularVelocityRadps, be.anchorLocalM, b.principalInertiaKgM2];
  if (!vectors.every(vector) || !matrix(b.rotationBodyToWorld) || typeof p.massKg !== 'number' || typeof b.massKg !== 'number') refuse('SCHEMA_INVALID');
  const numeric = [...vectors.flat() as number[], ...b.rotationBodyToWorld.flat(), p.massKg, b.massKg];
  if (!numeric.every(Number.isFinite)) refuse('NONFINITE_STATE');
  if (c.id === owner.bodyId || pe.clothId !== c.id || be.bodyId !== owner.bodyId) refuse('ENDPOINT_OWNER_MISMATCH');
  if (pe.vertexIndex < 0 || pe.vertexIndex >= c.vertexCount) refuse('ENDPOINT_INDEX_RANGE');
  if (c.pinnedVertexIndices.includes(pe.vertexIndex)) refuse('PINNED_ENDPOINT');
  if (p.massKg < 1 / 1024 || p.massKg > 1) refuse('POINT_MASS_RANGE');
  if (b.massKg < 1 / 1024 || b.massKg > 1) refuse('RIGID_MASS_RANGE');
  const moments = b.principalInertiaKgM2 as Vec3;
  if (moments.some(i => i < 1 / 4096 || i > 1)) refuse('INERTIA_RANGE');
  for (const v of [p.positionM, p.velocityMps, b.comPositionM, b.velocityMps, b.angularVelocityRadps] as Vec3[]) {
    if (v.some(x => Math.abs(x) > 1)) refuse('COMPONENT_RANGE');
  }
  if ((be.anchorLocalM as Vec3).some(x => Math.abs(x) > 1 / 2)) refuse('COMPONENT_RANGE');
  for (let i = 0; i < 3; i++) {
    if (moments[i] > moments[(i + 1) % 3] + moments[(i + 2) % 3]) refuse('NONPHYSICAL_INERTIA');
  }
  const rotation = b.rotationBodyToWorld, residualMax = 64 * 2 ** -52;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const value = rotation[0][i] * rotation[0][j] + rotation[1][i] * rotation[1][j] + rotation[2][i] * rotation[2][j];
    if (Math.abs(value - (i === j ? 1 : 0)) > residualMax) refuse('NOT_PROPER_ROTATION');
  }
  if (Math.abs(dot(rotation[0], cross(rotation[1], rotation[2])) - 1) > residualMax) refuse('NOT_PROPER_ROTATION');
  const arm = multiply(rotation, be.anchorLocalM as Vec3);
  const position = p.positionM as Vec3, com = b.comPositionM as Vec3;
  const coincidenceScale = Math.max(1, ...position.map(Math.abs), ...com.map(Math.abs), ...arm.map(Math.abs));
  for (let i = 0; i < 3; i++) {
    if (Math.abs(position[i] - (com[i] + arm[i])) > residualMax * coincidenceScale) refuse('ANCHOR_MISMATCH');
  }
}

function inverseWorldInertia(rotation: Mat3, moments: Vec3): Mat3 {
  const result: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    result[i][j] = rotation[i][0] * (1 / moments[0]) * rotation[j][0] +
      rotation[i][1] * (1 / moments[1]) * rotation[j][1] +
      rotation[i][2] * (1 / moments[2]) * rotation[j][2];
  }
  return result;
}
function solve3x3(matrix: Mat3, rhs: Vec3): Vec3 {
  // IMPULSE_DIRECT_SOLVE_ENTRY: one fixed direct factorization and one RHS.
  const a = matrix.map((row, i) => [row[0], row[1], row[2], rhs[i]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    if (a[pivot][column] === 0 || !Number.isFinite(a[pivot][column])) throw new Error('CONDENSED_SOLVE_FAILURE');
    [a[column], a[pivot]] = [a[pivot], a[column]];
    for (let row = column + 1; row < 3; row++) {
      const factor = a[row][column] / a[column][column];
      a[row][column] = 0;
      for (let k = column + 1; k < 4; k++) a[row][k] -= factor * a[column][k];
    }
  }
  const answer: Vec3 = [0, 0, 0];
  for (let row = 2; row >= 0; row--) {
    let value = a[row][3];
    for (let column = row + 1; column < 3; column++) value -= a[row][column] * answer[column];
    answer[row] = value / a[row][row];
  }
  if (!answer.every(Number.isFinite)) throw new Error('CONDENSED_SOLVE_FAILURE');
  return answer;
}
function copyPointEndpoint(endpoint: ClothVertexEndpoint): ClothVertexEndpoint {
  return {kind: endpoint.kind, clothId: endpoint.clothId, vertexIndex: endpoint.vertexIndex};
}
function copyRigidEndpoint(endpoint: RigidAnchorEndpoint): RigidAnchorEndpoint {
  return {kind: endpoint.kind, bodyId: endpoint.bodyId, anchorLocalM: copy3(endpoint.anchorLocalM)};
}
function kineticEnergy(point: PointState, rigid: RigidState): number {
  const bodyOmega = transposeMultiply(rigid.rotationBodyToWorld, rigid.angularVelocityRadps);
  const spin = rigid.principalInertiaKgM2[0] * bodyOmega[0] * bodyOmega[0] +
    rigid.principalInertiaKgM2[1] * bodyOmega[1] * bodyOmega[1] +
    rigid.principalInertiaKgM2[2] * bodyOmega[2] * bodyOmega[2];
  return 0.5 * (point.massKg * dot(point.velocityMps, point.velocityMps) + rigid.massKg * dot(rigid.velocityMps, rigid.velocityMps) + spin);
}
export function projectClothRigidImpulse(input: unknown): ImpulseResult {
  admit(input);
  const point = input.point, rigid = input.rigid;
  const arm = multiply(rigid.rotationBodyToWorld, rigid.endpoint.anchorLocalM);
  const inverseInertia = inverseWorldInertia(rigid.rotationBodyToWorld, rigid.principalInertiaKgM2);
  const relativeBefore = subtract(subtract(point.velocityMps, rigid.velocityMps), cross(rigid.angularVelocityRadps, arm));
  // K = (1/mp + 1/mb)I - [r]x Iworld^-1 [r]x.
  const effective: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let column = 0; column < 3; column++) {
    const basis: Vec3 = [0, 0, 0]; basis[column] = 1;
    const rotational = cross(multiply(inverseInertia, cross(arm, basis)), arm);
    for (let row = 0; row < 3; row++) effective[row][column] = (row === column ? 1 / point.massKg + 1 / rigid.massKg : 0) + rotational[row];
  }
  // IMPULSE_SOLVE_CALL: no zero-relative shortcut and no retry.
  const impulse = solve3x3(effective, scale(relativeBefore, -1));
  const pointCandidate: PointState = {
    endpoint: copyPointEndpoint(point.endpoint), positionM: copy3(point.positionM),
    velocityMps: add(point.velocityMps, scale(impulse, 1 / point.massKg)), massKg: point.massKg,
  };
  // IMPULSE_FIRST_SIDE_PREPARED: after point candidate, before rigid candidate.
  const rigidImpulse = scale(impulse, -1);
  const angularImpulse = cross(arm, rigidImpulse);
  const rigidCandidate: RigidState = {
    endpoint: copyRigidEndpoint(rigid.endpoint), comPositionM: copy3(rigid.comPositionM),
    velocityMps: add(rigid.velocityMps, scale(rigidImpulse, 1 / rigid.massKg)),
    angularVelocityRadps: add(rigid.angularVelocityRadps, multiply(inverseInertia, angularImpulse)),
    massKg: rigid.massKg, rotationBodyToWorld: rigid.rotationBodyToWorld.map(copy3) as Mat3,
    principalInertiaKgM2: copy3(rigid.principalInertiaKgM2),
  };
  const beforeJ = kineticEnergy(point, rigid), afterJ = kineticEnergy(pointCandidate, rigidCandidate);
  const report: ImpulseReport = {
    pointEndpoint: copyPointEndpoint(point.endpoint), rigidEndpoint: copyRigidEndpoint(rigid.endpoint),
    worldAnchorArmM: copy3(arm), pointLinearImpulseNs: copy3(impulse),
    rigidLinearImpulseNs: copy3(rigidImpulse), rigidAngularImpulseNms: copy3(angularImpulse),
    relativeVelocityBeforeMps: copy3(relativeBefore),
    relativeVelocityAfterMps: subtract(subtract(pointCandidate.velocityMps, rigidCandidate.velocityMps), cross(rigidCandidate.angularVelocityRadps, arm)),
    kineticEnergyBeforeJ: beforeJ, kineticEnergyAfterJ: afterJ, dissipatedEnergyJ: beforeJ - afterJ,
  };
  const result: ImpulseResult = {
    clothContext: {id: input.clothContext.id, vertexCount: input.clothContext.vertexCount, pinnedVertexIndices: input.clothContext.pinnedVertexIndices.slice()},
    rigidContext: {bodyId: input.rigidContext.bodyId}, point: pointCandidate, rigid: rigidCandidate, report,
  };
  if (![...pointCandidate.velocityMps, ...rigidCandidate.velocityMps, ...rigidCandidate.angularVelocityRadps,
    ...report.pointLinearImpulseNs, ...report.rigidLinearImpulseNs, ...report.rigidAngularImpulseNms,
    ...report.relativeVelocityBeforeMps, ...report.relativeVelocityAfterMps,
    report.kineticEnergyBeforeJ, report.kineticEnergyAfterJ, report.dissipatedEnergyJ].every(Number.isFinite)) throw new Error('NONFINITE_CANDIDATE');
  // IMPULSE_PAIR_PREPARED: both candidates and report complete, before pair return.
  return result;
}
