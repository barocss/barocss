import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicsWorld,PhysicsError} from '@barocss/physics';
import {makeP3Fixture} from './fixture.mjs';
test('current genuine public World retains original four-sphere/two-hinge refusal',()=>{
 const {model,options}=makeP3Fixture();
 assert.equal(model.bodies.length,4);assert.equal(model.joints.length,2);assert.equal(options.fixedStepSeconds,1/120);
 assert.deepEqual(model.bodies.map(b=>b.id),['pairA0','pairB0','pairA1','pairB1']);
 let refusal;
 try{const world=createPhysicsWorld(model,options);world.dispose();assert.fail('unqualified public admission unexpectedly enabled');}
 catch(error){assert.ok(error instanceof PhysicsError);assert.equal(error.code,'INVALID_CONFIG');assert.equal(error.message,'dynamic pair supports one joint between two dynamic spheres');refusal={code:error.code,message:error.message};}
 console.log(JSON.stringify({status:'CURRENT_PUBLIC_REFUSED',physicalQualification:'NO_GO',constructorAttempts:1,worldSteps:0,refusal}));
});
