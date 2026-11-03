import assert from 'node:assert/strict';

const local=()=>({positionM:[0,0,0],orientationXYZW:[0,0,0,1]});
function make(profile,friction,persistent=false){
 const cube={kind:'box',halfExtentsM:[.25,.25,.25]},sphere={kind:'sphere',radiusM:.2};
 const model={format:'barocss-physics-model',version:1,revision:'canonical-word-parity01',
  frame:{id:'world',basis:'right-handed-xyz',rotation:'local-to-world-xyzw'},units:{length:'m',mass:'kg',time:'s',angle:'rad'},gravityMps2:[0,-9.81,0],
  bodies:[{id:'a-floor',kind:'static',initial:{positionM:[0,-.1,0],orientationXYZW:[0,0,0,1]}},
   {id:'b-body',kind:'dynamic',massKg:1,inertia:{kind:'primitive-com',about:'com',frame:'body-local'},
    initial:{positionM:[-0,persistent ? .25 : .2,0],orientationXYZW:[0,0,0,1],velocityMps:[friction?1:0,0,0],angularVelocityRadps:[0,0,0]}}],
  colliders:[{id:'a-floor.shape',bodyId:'a-floor',geometry:{kind:'box',halfExtentsM:[2,.1,2]}},
   {id:'b-body.shape',bodyId:'b-body',geometry:persistent?cube:sphere}].map(c=>({...c,local:local(),material:{restitution:0,friction:{static:friction ? .5 : 0,dynamic:friction ? .3 : 0}},sensor:false,ccd:false,filter:{categoryBits:1,maskBits:65535}})),
  joints:[],cloths:[],fluids:[],sourceBindings:[]};
 return {model,options:{profile,fixedStepSeconds:1/120,broadPhase:'direct'}};
}
export const cases=[['sphere-normal',make('rigid-discrete-v1',false)],['sphere-radial-friction',make('rigid-discrete-v1',true)],['persistent-multipoint-warm',make('rigid-persistent-box-v1',false,true)]];

export function campaign(api,replay){
 const results=[];
 for(const [name,{model,options}] of cases){
  const world=api.createPhysicsWorld(model,options), recorder=replay.createPhysicsRecorder(world);
  let restored;
  try{
   const states=[world.getState(),recorder.step(),recorder.step(),recorder.step()];
   const saved=recorder.saveRecording(), wire=replay.serializePhysicsRecording(saved), decoded=replay.deserializePhysicsRecording(wire);
   assert.equal(saved.version,1);assert.equal(Buffer.from(wire.subarray(0,8)).toString('ascii'),'BCPHREC1');
   assert.deepStrictEqual(decoded,saved);
   restored=replay.restorePhysicsRecording(decoded,{model,options,providerDigest:states[0].identity.providerDigest});
   const live=restored.world.getState(), continued=recorder.step(), replayContinued=restored.recorder.step();
   assert.deepStrictEqual(live,states[3]); assert.deepStrictEqual(continued,replayContinued);
   assert.ok(states[1].contacts.length>0);
   results.push({name,model,options,states,saved,decoded,restored:live,continued,replayContinued});
  }finally{recorder.dispose();world.dispose();restored?.recorder.dispose();restored?.world.dispose();}
 }
 return results;
}

// Only this exact identity field may vary. No model/body/number normalization.
export function compareWords(left,right,path='$',counts={numbers:0,metadataExceptions:0}){
 if(path.endsWith('.identity.providerDigest')){
  assert.match(left,/^sha256:[0-9a-f]{64}$/);assert.match(right,/^sha256:[0-9a-f]{64}$/);
  counts.metadataExceptions++;return counts;
 }
 if(typeof left==='number'){
  assert.equal(typeof right,'number',path);assert.ok(Object.is(left,right),`${path}: ${left} differs from ${right}`);
  counts.numbers++;return counts;
 }
 if(left===null||typeof left!=='object'){assert.strictEqual(left,right,path);return counts;}
 assert.ok(right!==null&&typeof right==='object',path);
 assert.deepStrictEqual(Object.keys(left),Object.keys(right),path+' keys');
 for(const key of Object.keys(left))compareWords(left[key],right[key],path+'.'+key,counts);
 return counts;
}
