import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
function assertFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}
// Direct P0 fixture authoring. The immutable fixtures.mjs is retained as the
// historical input ledger; none of its old DTOs is converted or sent to World.
function authoredInputs() {
  const material={static:1,dynamic:.7};
  const cube=(id,positionM,orientationXYZW)=>dynamicPart(id,{kind:'box',halfExtentsM:[.25,.25,.25]},
    {positionM,velocityMps:[0,0,0],...(orientationXYZW?{orientationXYZW}:{})},1,{restitution:0,friction:{...material}});
  const floor=()=>staticPart('floor',{kind:'box',halfExtentsM:[2,.1,2]},
    {positionM:[0,-.1,0]},{restitution:0,friction:{...material}});
  const stack=rotated=>Array.from({length:8},(_,i)=>{
    const yaw=(-1)**i*.05;
    return cube(`b${i}`,[rotated?i%2*.05:0,.25+.5*i,0],rotated?[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]:undefined);
  });
  const pair=i=>({parts:[
    dynamicPart(`pairA${i}`,{kind:'sphere',radiusM:.1},{positionM:[-.1,0,i],velocityMps:[0,0,0]},1,{restitution:0,friction:{...material}}),
    dynamicPart(`pairB${i}`,{kind:'sphere',radiusM:.1},{positionM:[.1,0,i],velocityMps:[0,0,0]},1,{restitution:0,friction:{...material}})],
    joint:{id:`hinge${i}`,kind:'hinge',bodyAId:`pairA${i}`,bodyBId:`pairB${i}`,
      anchorALocalM:[.1,0,0],anchorBLocalM:[-.1,0,0],axisWorld:[0,0,1],limitRad:[-.8,.8],
      motor:{targetSpeedRadps:.5,maxImpulseNms:.0001,maxReactionNms:.01}}});
  const options=profile=>({profile,fixedStepSeconds:1/120,broadPhase:profile==='rigid-large-persistent-box-v1'?'aabb':'direct'});
  const a=pair(0),b=pair(1);
  return new Map([
    ['DROP16',{model:makeModel({parts:[...Array.from({length:16},(_,i)=>cube(`b${i}`,[(i%4-1.5)*.75,1.5,(Math.floor(i/4)-1.5)*.75])),floor()]}),options:options('rigid-discrete-v1')}],
    ['STACK2_CONTROL',{model:makeModel({parts:[cube('b0',[0,.25,0]),cube('b1',[.05,.75,0]),floor()]}),options:options('rigid-persistent-box-v1')}],
    ['STACK8_ALIGNED',{model:makeModel({parts:[...stack(false),floor()]}),options:options('rigid-persistent-box-v1')}],
    ['STACK8_ROTATED',{model:makeModel({parts:[...stack(true),floor()]}),options:options('rigid-persistent-box-v1')}],
    ['STACK8_BASIC',{model:makeModel({parts:[...stack(false),floor()]}),options:options('rigid-discrete-v1')}],
    // No combined large/persistent profile exists. Explicit unsupported profile
    // admission replaces the old combination of two incompatible selectors.
    ['LARGE_STACK8_PERSISTENT',{model:makeModel({parts:[...stack(false),floor()]}),options:options('rigid-large-persistent-box-v1')}],
    ['HINGE1_CONTROL',{model:makeModel({gravityMps2:[0,0,0],parts:a.parts,joints:[a.joint]}),options:options('rigid-discrete-v1')}],
    ['HINGE2',{model:makeModel({gravityMps2:[0,0,0],parts:[...a.parts,...b.parts],joints:[a.joint,b.joint]}),options:options('rigid-discrete-v1')}],
    ['CAPSULE_THIN_CCD',{model:makeModel({gravityMps2:[0,0,0],parts:[
      dynamicPart('b0',{kind:'capsule',radiusM:.1,halfLengthM:.2},{positionM:[-.4,0,0],velocityMps:[100,0,0]},1,{restitution:0,friction:{...material},ccd:true}),
      staticPart('floor',{kind:'box',halfExtentsM:[.001,1,1]},{positionM:[0,0,0]},{restitution:0,friction:{...material}})]}),options:options('rigid-discrete-v1')}],
  ]);
}
export function runAdmission(createPhysicsWorld, PhysicsError, fixtures) {
  const authored=authoredInputs();
  assert.deepEqual([...authored.keys()],fixtures.map(fixture=>fixture.id),'explicit P0 fixture IDs must match the immutable ledger');
  return fixtures.map(({ id, input }) => {
    const {model,options}=authored.get(id);
    const immutableModel=structuredClone(model),immutableOptions=structuredClone(options);
    const immutableInput = structuredClone(input);
    let world;
    try { world = createPhysicsWorld(model,options); }
    catch (e) {
      assert.ok(e instanceof PhysicsError, `${id}: canonical public error`);
      assert.equal(e.code, 'INVALID_CONFIG');
      assert.deepEqual(input, immutableInput, `${id}: historical input changed`);
      assert.deepEqual(model,immutableModel,`${id}: refused model changed`);
      assert.deepEqual(options,immutableOptions,`${id}: refused options changed`);
      return { id, input: immutableInput, model:immutableModel,options:immutableOptions, admission: 'refused', error: { code: e.code, message: e.message }, quality: 'unmeasured' };
    }
    try {
      const initial = world.getState();
      assert.equal(initial.stepIndex, 0);
      assert.equal(initial.timeSeconds, 0);
      const accepted = world.step();
      assert.equal(accepted.stepIndex, 1);
      assert.equal(accepted.timeSeconds, options.fixedStepSeconds);
      assertFinite(accepted);
      const retained = structuredClone(accepted);
      accepted.bodies[0].positionM[0] += 100;
      assert.deepEqual(world.getState(), retained, `${id}: copied state`);
      assert.throws(() => world.step(1 / 100), e => e instanceof PhysicsError && e.code === 'INVALID_COMMAND');
      assert.deepEqual(world.getState(), retained, `${id}: failed-step retention`);
      assert.deepEqual(input, immutableInput, `${id}: historical input changed`);
      assert.deepEqual(model,immutableModel,`${id}: accepted model changed`);
      assert.deepEqual(options,immutableOptions,`${id}: accepted options changed`);
      world.dispose(); world.dispose();
      assert.throws(() => world.getState(), e => e instanceof PhysicsError && e.code === 'DISPOSED');
      return { id, input: immutableInput, model:immutableModel,options:immutableOptions, admission: 'admitted', initial, accepted: retained, lifecycle: { finite: true, copied: true, badStepRetained: true, disposed: true }, quality: 'unmeasured' };
    } finally { world.dispose(); }
  });
}
