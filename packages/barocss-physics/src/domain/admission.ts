/** Complete pure-data P5 admission. Runtime buffers and initialization belong to World. */
import type { PhysicsModel, VisualProfileId, WorldOptions } from '../types.js';
import type { DomainModelData, StaticDomainData } from './types.js';
import { error, finite } from '../validation.js';
import { ID } from '../limits.js';
import { CLOTH_PROFILE, CLOTH_STEP_SECONDS } from '../cloth/profile.js';
import { FLUID_BASIN_M, FLUID_MIN_SPACING_M, FLUID_PARTICLE_RADIUS_M,
  FLUID_SMOOTHING_RADIUS_M } from '../fluid/constants.js';
import { inflatedBoxBounds, insideStaticBox } from '../fluid/static-box.js';
import { nativeClothReference } from './cloth-reference.generated.js';

const PROFILES: readonly string[] = ['cloth-pinned-sphere-visual-v1', 'fluid-basin-visual-v1',
  'fluid-basin-xsph-visual-v1', 'fluid-static-box-visual-v1'];
const CLOTH_FIELDS = ['id','restPositionsM','initialPositionsM','initialVelocitiesMps','vertexMassesKg',
  'triangles','pinnedVertexIndices','constraints','staticColliderIds'];
const FLUID_FIELDS = ['id','initialPositionsM','initialVelocitiesMps','massModel','particleRadiusM',
  'smoothingRadiusM','staticColliderIds','visualSmoothing'];
type Data = Record<string, unknown>;

function check(value: unknown, message: string): asserts value {
  if (!value) error('INVALID_CONFIG', message);
}
function exact(value: unknown, keys: readonly string[], label: string): Data {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} requires a record`);
  const input = value as Data;
  check(Object.keys(input).length === keys.length && keys.every(key => Object.hasOwn(input,key)), `${label} requires exact fields`);
  return input;
}
function array(value: unknown, count: number, label: string): unknown[] {
  check(Array.isArray(value) && value.length === count, `${label} requires exactly ${count} entries`);
  return value;
}
function triple(value: unknown, label: string): readonly [number,number,number] {
  const result = array(value,3,label);
  result.forEach((part,index) => finite(part,-10000,10000,`${label}[${index}]`));
  return result as [number,number,number];
}
/** Object field order is inert; array order and every numeric representation are exact. */
function same(value: unknown, expected: unknown, label: string): void {
  if (typeof expected !== 'object' || expected === null) {
    check(Object.is(value,expected), `${label} differs from the fixed native profile`); return;
  }
  if (Array.isArray(expected)) {
    array(value,expected.length,label).forEach((item,index) => same(item,expected[index],`${label}[${index}]`)); return;
  }
  const reference = expected as Data, input = exact(value,Object.keys(reference),label);
  for (const key of Object.keys(reference)) same(input[key],reference[key],`${label}.${key}`);
}
function transform(value: unknown, label: string, local = false): Data {
  const input = exact(value,['positionM','orientationXYZW'],label);
  triple(input.positionM,`${label}.positionM`);
  same(input.orientationXYZW,[0,0,0,1],`${label}.orientationXYZW`);
  if (local) same(input.positionM,[0,0,0],`${label}.positionM`);
  return input;
}

/** Caller has passed common copyData/header validation. No initializer is invoked. */
export function admitDomainModel(model: PhysicsModel, options: WorldOptions): DomainModelData | null {
  if (!PROFILES.includes(options.profile)) return null;
  const profile = options.profile as VisualProfileId;
  check(options.broadPhase === 'domain-fixed' && Object.is(options.fixedStepSeconds,CLOTH_STEP_SECONDS), 'Unsupported domain options');
  same(model.gravityMps2,CLOTH_PROFILE.gravityMps2,'gravityMps2');
  const clothProfile = profile === 'cloth-pinned-sphere-visual-v1';
  const boxProfile = profile === 'fluid-static-box-visual-v1';
  const count = boxProfile ? 2 : 1;
  const bodyInputs = array(model.bodies,count,'bodies');
  const colliderInputs = array(model.colliders,count,'colliders');
  array(model.joints,0,'joints');
  const clothInputs = array(model.cloths,clothProfile ? 1 : 0,'cloths');
  const fluidInputs = array(model.fluids,clothProfile ? 0 : 1,'fluids');
  check(Array.isArray(model.sourceBindings) && model.sourceBindings.length <= 128,'Unsupported source binding population');
  const ids = new Set<string>();
  function id(value: unknown): string {
    check(typeof value === 'string' && ID.test(value) && !ids.has(value),'Invalid or duplicate global entity ID');
    ids.add(value); return value;
  }
  const bodies = new Map<string,Data>();
  for (const value of bodyInputs) {
    const body = exact(value,['id','kind','initial'],'static body');
    const bodyId = id(body.id); check(body.kind === 'static','Domain owners must be static');
    transform(body.initial,'static initial'); bodies.set(bodyId,body);
  }
  const colliders = new Map<string,Data>();
  const owners = new Set<string>();
  for (const value of colliderInputs) {
    const collider = exact(value,['id','bodyId','geometry','local','material','sensor','ccd','filter'],'collider');
    const colliderId = id(collider.id);
    check(typeof collider.bodyId === 'string' && bodies.has(collider.bodyId) && !owners.has(collider.bodyId), 'Collider requires one declared static owner');
    owners.add(collider.bodyId);
    const geometry = exact(collider.geometry, (collider.geometry as Data)?.kind === 'sphere'
      ? ['kind','radiusM'] : ['kind','halfExtentsM'],'geometry');
    if (geometry.kind === 'sphere') finite(geometry.radiusM,0.0001,1000,'radiusM');
    else {
      check(geometry.kind === 'box' || geometry.kind === 'box-interior','Unsupported domain geometry');
      array(geometry.halfExtentsM,3,'halfExtentsM').forEach(value => finite(value,0.0001,1000,'halfExtentsM'));
    }
    transform(collider.local,'collider.local',true);
    const material = exact(collider.material,['restitution','friction'],'material');
    same(material.restitution,0,'restitution');
    same(material.friction,{static:0,dynamic:0},'friction');
    same(collider.sensor,false,'sensor'); same(collider.ccd,false,'ccd');
    same(collider.filter,{categoryBits:1,maskBits:65535},'filter');
    colliders.set(colliderId,collider);
  }
  check(owners.size === bodies.size,'Every static owner requires one collider');
  const data = clothProfile ? exact(clothInputs[0],CLOTH_FIELDS,'cloth') : exact(fluidInputs[0],FLUID_FIELDS,'fluid');
  id(data.id);
  const refs = array(data.staticColliderIds,count,'staticColliderIds');
  check(new Set(refs).size === refs.length && refs.every(ref => typeof ref === 'string' && colliders.has(ref)), 'Invalid domain collider references');
  const numericalIds = new Set(ids);
  for (const value of model.sourceBindings) {
    const binding = exact(value,['id','sourceRevision','sourceDigest','modelId','occurrenceId','entityIds','approximation'],'sourceBinding');
    id(binding.id);
    for (const key of ['sourceRevision','modelId','occurrenceId']) check(typeof binding[key] === 'string' &&
      (binding[key] as string).length > 0 && (binding[key] as string).length <= 4096, `Invalid ${key}`);
    check(typeof binding.sourceDigest === 'string' && /^sha256:[0-9a-f]{64}$/.test(binding.sourceDigest),'Invalid source digest');
    check(Array.isArray(binding.entityIds) && binding.entityIds.length > 0 && binding.entityIds.length <= 128 &&
      new Set(binding.entityIds).size === binding.entityIds.length && binding.entityIds.every(ref =>
        typeof ref === 'string' && numericalIds.has(ref)), 'Invalid source binding references');
    const approximation = exact(binding.approximation,['kind','lossLabel'],'approximation');
    check(approximation.kind === 'control-net-box' || approximation.kind === 'control-net-sphere','Unsupported approximation');
    check(typeof approximation.lossLabel === 'string' && approximation.lossLabel.length > 0 && approximation.lossLabel.length <= 4096,'Invalid loss label');
  }
  const staticData: StaticDomainData = { profile, gravityMps2:model.gravityMps2, bodies:model.bodies, colliders:model.colliders };
  if (clothProfile) {
    for (const key of CLOTH_FIELDS) if (key !== 'id' && key !== 'staticColliderIds') same(data[key],nativeClothReference[key as keyof typeof nativeClothReference],`cloth.${key}`);
    const collider = colliderInputs[0] as Data, body = bodies.get(collider.bodyId as string)!;
    same(collider.geometry,{kind:'sphere',radiusM:CLOTH_PROFILE.sphereRadiusM},'cloth sphere');
    same((body.initial as Data).positionM,CLOTH_PROFILE.sphereCentreM,'cloth sphere position');
    return {kind:'cloth',data:model.cloths[0],staticData};
  }
  same(data.massModel,{kind:'visual-unit-weights'},'massModel');
  same(data.particleRadiusM,FLUID_PARTICLE_RADIUS_M,'particleRadiusM');
  same(data.smoothingRadiusM,FLUID_SMOOTHING_RADIUS_M,'smoothingRadiusM');
  same(data.visualSmoothing,profile === 'fluid-basin-xsph-visual-v1' ? {kind:'xsph',coefficient:0.15} : {kind:'none'},'visualSmoothing');
  const points = array(data.initialPositionsM,256,'initialPositionsM').map((point,index) => triple(point,`initialPositionsM[${index}]`));
  array(data.initialVelocitiesMps,256,'initialVelocitiesMps').forEach((velocity,index) => same(velocity,[0,0,0],`initialVelocitiesMps[${index}]`));
  for (const point of points) for (let axis=0;axis<3;axis++) check(point[axis] >= FLUID_PARTICLE_RADIUS_M &&
    point[axis] <= FLUID_BASIN_M[axis]-FLUID_PARTICLE_RADIUS_M,'Initial particle is outside the basin');
  const minimumSquared = FLUID_MIN_SPACING_M ** 2;
  for (let first=0;first<256;first++) for (let second=first+1;second<256;second++) {
    const dx=points[first][0]-points[second][0], dy=points[first][1]-points[second][1], dz=points[first][2]-points[second][2];
    check(!(dx*dx+dy*dy+dz*dz < minimumSquared-1e-12),'Initial particles must be at least 0.025 m apart');
  }
  const basin = colliderInputs.find(value => ((value as Data).geometry as Data).kind === 'box-interior') as Data | undefined;
  check(basin,'Fluid requires one basin');
  const basinHalf = FLUID_BASIN_M.map(value => value/2);
  same((basin.geometry as Data).halfExtentsM,basinHalf,'basin half extents');
  same((bodies.get(basin.bodyId as string)!.initial as Data).positionM,basinHalf,'basin position');
  if (boxProfile) {
    const box = colliderInputs.find(value => ((value as Data).geometry as Data).kind === 'box') as Data | undefined;
    check(box,'Static fluid profile requires one box');
    const body = bodies.get(box.bodyId as string)!;
    const bounds = inflatedBoxBounds((body.initial as Data).positionM as [number,number,number],
      (box.geometry as Data).halfExtentsM as [number,number,number]);
    for (let axis=0;axis<3;axis++) check(bounds.low[axis] >= FLUID_PARTICLE_RADIUS_M &&
      bounds.high[axis] <= FLUID_BASIN_M[axis]-FLUID_PARTICLE_RADIUS_M,'Static box exceeds the basin');
    // Bounded admission-only scratch for the unchanged legacy overlap helper.
    // It is not retained by DomainModelData. World initialization later makes
    // its own runtime arrays and invokes the original box helper again.
    const overlapScratch = Float64Array.from(points.flat());
    check(!insideStaticBox(overlapScratch,bounds),'Static box overlaps initial particles');
  } else check(colliderInputs.length === 1,'Unsupported fluid collider population');
  return {kind:'fluid',data:model.fluids[0],staticData};
}
