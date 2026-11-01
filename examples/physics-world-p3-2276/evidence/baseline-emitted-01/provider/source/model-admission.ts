import type { PhysicsModel, WorldOptions } from './types.js';
import type { Body, Joint } from './internal-types.js';
import { copyData } from './identity.js';
import { error, finite, parseBody, vector } from './validation.js';
import { parseJoints } from './joints.js';
import { ID } from './limits.js';

function exact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) error('INVALID_CONFIG', `${label} must be a record`);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) error('INVALID_CONFIG', `${label} requires exact fields: ${keys.join(',')}`);
  return input;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) error('INVALID_CONFIG', `${label} must be a bounded nonempty string`);
  return value;
}
function list(value: unknown, maximum: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) error('INVALID_CONFIG', `${label} exceeds the profile bound`);
  return value;
}
function transform(value: unknown, label: string): void {
  const t = exact(value, ['positionM','orientationXYZW'], label);
  vector(t.positionM,-10000,10000,`${label}.positionM`);
  if (!Array.isArray(t.orientationXYZW) || t.orientationXYZW.length !== 4) error('INVALID_CONFIG', `${label} requires an XYZW quaternion`);
  const q = t.orientationXYZW.map((x) => finite(x,-1,1,label));
  if (Math.abs(Math.hypot(...q)-1)>1e-6) error('INVALID_CONFIG', `${label} quaternion must have unit norm`);
}
export function admitModel(rawModel: PhysicsModel, rawOptions: WorldOptions): {
  model: PhysicsModel; options: WorldOptions; bodies: Body[]; joints: Joint[];
} {
  // Copy before dependent reads; getters, custom prototypes and sparse arrays never reach parsers.
  const model = copyData(rawModel);
  const options = copyData(rawOptions);
  const input = exact(model,['format','version','revision','frame','units','gravityMps2','bodies','colliders','joints','cloths','fluids','sourceBindings'],'model');
  if (input.format !== 'barocss-physics-model' || input.version !== 1) error('INVALID_CONFIG','unsupported model format or version');
  text(input.revision,'revision');
  const frame=exact(input.frame,['id','basis','rotation'],'frame'); text(frame.id,'frame.id');
  if(frame.basis!=='right-handed-xyz'||frame.rotation!=='local-to-world-xyzw') error('INVALID_CONFIG','unsupported frame convention');
  const units=exact(input.units,['length','mass','time','angle'],'units');
  if(units.length!=='m'||units.mass!=='kg'||units.time!=='s'||units.angle!=='rad') error('INVALID_CONFIG','model units must be m/kg/s/rad');
  vector(input.gravityMps2,-1000,1000,'gravityMps2');
  const opt=exact(options,['profile','fixedStepSeconds','broadPhase'],'options');
  if(!['rigid-discrete-v1','rigid-persistent-box-v1','rigid-large-v1'].includes(opt.profile as string)) error('INVALID_CONFIG','profile is not implemented');
  finite(opt.fixedStepSeconds,1/240,1/30,'fixedStepSeconds');
  const large=opt.profile==='rigid-large-v1';
  if(opt.broadPhase!=='aabb' && (large||opt.broadPhase!=='direct')) error('INVALID_CONFIG','unsupported broadPhase for profile');
  const bodyInputs=list(input.bodies,large?64:opt.profile==='rigid-persistent-box-v1'?4:32,'bodies');
  if(bodyInputs.length===0) error('INVALID_CONFIG','at least one body is required');
  const colliders=list(input.colliders,bodyInputs.length,'colliders');
  const jointInputs=list(input.joints,large?0:8,'joints');
  list(input.cloths,0,'cloths'); list(input.fluids,0,'fluids');
  const bindings=list(input.sourceBindings,128,'sourceBindings');
  const ids=new Set<string>();
  function id(value: unknown): string { if(typeof value!=='string'||!ID.test(value)||ids.has(value)) error('INVALID_CONFIG','invalid or duplicate global entity ID'); ids.add(value);return value; }
  const bodiesById=new Map<string,Record<string,unknown>>();
  for(const value of bodyInputs){
    const raw=value as Record<string,unknown>;
    const b=exact(value,raw?.kind==='dynamic'?['id','kind','massKg','inertia','initial']:['id','kind','initial'],'body');
    const bodyId=id(b.id);
    if(!['dynamic','static','kinematic'].includes(b.kind as string)) error('INVALID_CONFIG','unsupported body kind');
    if(b.kind==='dynamic') {
      const initial=exact(b.initial,['positionM','orientationXYZW','velocityMps','angularVelocityRadps'],'initial');
      transform({positionM:initial.positionM,orientationXYZW:initial.orientationXYZW},'initial');
      vector(initial.velocityMps,-1000,1000,'velocityMps');vector(initial.angularVelocityRadps,-1000,1000,'angularVelocityRadps');
      finite(b.massKg,1e-6,1e6,'massKg');
      const i=b.inertia as Record<string,unknown>;
      exact(i,i?.kind==='sphere-isotropic'?['kind','about','frame','kgM2']:['kind','about','frame'],'inertia');
      if(i.about!=='com'||i.frame!=='body-local'||!['primitive-com','sphere-isotropic'].includes(i.kind as string)) error('INVALID_CONFIG','unsupported inertia');
      if(i.kind==='sphere-isotropic')finite(i.kgM2,1e-12,1e12,'inertia.kgM2');
    } else transform(b.initial,'initial');
    bodiesById.set(bodyId,b);
  }
  const colliderByBody=new Map<string,Record<string,unknown>>();
  for(const value of colliders){
    const c=exact(value,['id','bodyId','geometry','local','material','sensor','ccd','filter'],'collider'); id(c.id);
    if(typeof c.bodyId!=='string'||!bodiesById.has(c.bodyId)||colliderByBody.has(c.bodyId)) error('INVALID_CONFIG','collider requires a unique declared owner');
    transform(c.local,'collider.local'); const local=c.local as {positionM:number[];orientationXYZW:number[]};
    if(local.positionM.some(x=>x!==0)||local.orientationXYZW.some((x,i)=>x!==(i===3?1:0)))error('INVALID_CONFIG','only identity-local colliders are admitted');
    if(typeof c.sensor!=='boolean'||typeof c.ccd!=='boolean')error('INVALID_CONFIG','sensor and ccd must be explicit booleans');
    const material=exact(c.material,['restitution','friction'],'material'); exact(material.friction,['static','dynamic'],'friction');
    const filter=exact(c.filter,['categoryBits','maskBits'],'filter');
    if(!large&&(filter.categoryBits!==1||filter.maskBits!==65535))error('INVALID_CONFIG','non-large profile requires no-filter values');
    const body=bodiesById.get(c.bodyId)!;
    if((c.sensor&&body.kind==='dynamic')||(c.ccd&&body.kind!=='dynamic'))error('INVALID_CONFIG','unsupported sensor or CCD body role');
    colliderByBody.set(c.bodyId,c);
  }
  if(colliderByBody.size!==bodyInputs.length)error('INVALID_CONFIG','each rigid body requires exactly one collider');
  const bodies=bodyInputs.map(value=>{
    const b=value as Record<string,unknown>; const c=colliderByBody.get(b.id as string)!;
    const initial=b.initial as Record<string,unknown>; const material=c.material as Record<string,unknown>;
    const inertia=b.inertia as Record<string,unknown>|undefined;
    // Numeric body parser constructs the kernel record directly. No old World/config exists.
    return parseBody({id:b.id,kind:b.kind,shape:c.geometry,positionM:initial.positionM,orientation:initial.orientationXYZW,
      restitution:material.restitution,friction:material.friction,...(large?{collisionFilter:c.filter}:{}),
      ...(c.sensor?{sensor:true}:{}),...(c.ccd?{ccd:true}:{}),
      ...(b.kind==='dynamic'?{massKg:b.massKg,velocityMps:initial.velocityMps,angularVelocityRadps:initial.angularVelocityRadps,
        ...(inertia?.kind==='sphere-isotropic'?{inertiaKgM2:inertia.kgM2}:{})}:{})},large);
  });
  if(!bodies.some(b=>b.kind==='dynamic'))error('INVALID_CONFIG','at least one dynamic body is required');
  if(large&&bodies.some(b=>b.ccd))error('INVALID_CONFIG','large profile excludes CCD');
  const numericJoints=jointInputs.map(value=>{
    const raw=value as Record<string,unknown>;
    const j=exact(value,raw?.kind==='hinge'?['id','kind','bodyAId','bodyBId','anchorALocalM','anchorBLocalM','axisWorld','limitRad','motor']:['id','kind','bodyAId','bodyBId','anchorALocalM','anchorBLocalM'],'joint');id(j.id);
    if(j.kind!=='fixed'&&j.kind!=='hinge')error('INVALID_CONFIG','unsupported joint kind');
    if(j.kind==='hinge'&&j.motor!==null)exact(j.motor,['targetSpeedRadps','maxImpulseNms','maxReactionNms'],'motor');
    return {id:j.id,kind:j.kind,aId:j.bodyAId,bId:j.bodyBId,anchorALocalM:j.anchorALocalM,anchorBLocalM:j.anchorBLocalM,
      ...(j.kind==='hinge'?{axisWorld:j.axisWorld,limitRad:j.limitRad,...(j.motor===null?{}:{motor:j.motor})}:{})};
  });
  const joints=parseJoints(numericJoints,bodies);
  // Bindings are inert provenance. All references must resolve to declared numerical entities.
  const numericalIds = new Set(ids);
  for(const value of bindings){
    const s=exact(value,['id','sourceRevision','sourceDigest','modelId','occurrenceId','entityIds','approximation'],'sourceBinding');id(s.id);
    for(const key of ['sourceRevision','modelId','occurrenceId'])text(s[key],key);
    if(typeof s.sourceDigest!=='string'||!/^sha256:[0-9a-f]{64}$/.test(s.sourceDigest))error('INVALID_CONFIG','invalid source digest');
    const refs=list(s.entityIds,128,'entityIds');if(refs.length===0||new Set(refs).size!==refs.length||refs.some(ref=>typeof ref!=='string'||!numericalIds.has(ref)))error('INVALID_CONFIG','invalid source binding references');
    const a=exact(s.approximation,['kind','lossLabel'],'approximation');if(a.kind!=='control-net-box'&&a.kind!=='control-net-sphere')error('INVALID_CONFIG','unsupported approximation');text(a.lossLabel,'lossLabel');
  }
  return {model,options,bodies,joints};
}
