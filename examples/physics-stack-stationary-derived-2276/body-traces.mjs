// Data recovery only. Expected traces are test observations, never engine input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openSync,closeSync,readSync,writeSync,fsyncSync,readFileSync,writeFileSync,mkdirSync,statSync,existsSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const out=resolve(process.argv[2]??'');assert.ok(out.startsWith(home+'/evidence/'));
assert.ok(!existsSync(out),'fresh derived output required');mkdirSync(out,{recursive:true});
const complete=join(root,'examples/physics-stack-stationary-complete-2276');
const full=join(complete,'evidence/full-01'),campaignPath=join(full,'campaign-result.json');
const pin=path=>{
 const fd=openSync(path,'r'),buffer=Buffer.alloc(65536),hash=createHash('sha256');
 try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,n));}
 finally{closeSync(fd);}return {bytes:statSync(path).size,sha256:hash.digest('hex')};
};
const read=path=>{assert.ok(statSync(path).size<=2**21);return JSON.parse(readFileSync(path,'utf8'));};
const put=(name,value,exclusive=true)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:exclusive?'wx':'w'});
const campaign=read(campaignPath),pins=read(join(complete,'PINS.json'));
assert.equal(campaign.status,'ORIGINAL_INDEPENDENT_PHYSICS_3600_CONFIRMED');
assert.equal(campaign.independentFullPhysicsSteps,3600);assert.equal(campaign.firstFailure,null);
const readerInputs=Object.fromEntries(Object.entries(pins.files).filter(([path])=>
 /^examples\/physics-stack-stream(?:-native-crc|-sized)?-2276\//.test(path)&&/\.mjs$/.test(path)));
for(const [path,expected]of Object.entries(readerInputs))assert.deepEqual(pin(join(root,path)),expected);
const {verifyArchive}=await import(pathToFileURL(join(root,'examples/physics-stack-stream-native-crc-2276/archive.mjs')));
const result={format:'stationary-public-word-oracle-v1',status:'RUNNING',testOnlyNeverEngineInput:true,
 newPhysicsCalls:0,newReferenceCalls:0,profile:'STATIONARY_NORMAL_EXACT_V1',providerDigest:pins.providerDigest,
 qualification:{path:'examples/physics-stack-stationary-complete-2276/evidence/full-01/campaign-result.json',...pin(campaignPath)},
 fieldOrder:['positionM','velocityMps','orientationXYZW','angularVelocityRadps'],
 sourceOrientationField:'orientation',readerInputs,scenes:{},publicAPI:false};
const deadline=Date.now()+170000;
try{
 for(const scene of ['ALIGNED','OFFSET','YAW']){
  assert.ok(Date.now()<deadline,'derived-data deadline');
  const host=read(join(full,scene,'host/result.json')),owner=read(join(full,scene,'summary.json'));
  assert.equal(host.status,'COMPLETE_SCENE_PHYSICAL_CONFIRMED');assert.equal(host.lastContiguous,1200);
  assert.equal(owner.status,'CPU_COMPLETE_ORIGINAL_SCENE');assert.equal(host.terminalQualityPassed,241);
  const source=join(full,scene,'host/events.gz');assert.equal(statSync(source).size,host.archive.compressedBytes);
  const path=join(out,scene+'.f64le'),fd=openSync(path,'wx');let frames=0,bodyIds=null;
  try{
   const recovered=await verifyArchive(source,entry=>{
    if(entry.header.channel!=='record')return;
    const step=entry.header.step,record=entry.record;
    assert.equal(step,frames);assert.equal(record.scene,scene);
    const bodies=step===0?record.state.bodies:record.prepared.candidateBodies;
    assert.equal(bodies.length,9);const ids=bodies.map(body=>body.id);
    if(bodyIds===null)bodyIds=ids;else assert.deepEqual(ids,bodyIds);
    const actual=Buffer.alloc(936);let offset=0;
    for(const body of bodies)for(const [field,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]){
     for(let k=0;k<n;k++){assert.ok(Number.isFinite(body[field][k]));actual.writeDoubleLE(body[field][k],offset);offset+=8;}
    }
    assert.deepEqual(actual,entry.bodyRaw.subarray(-936),'actual final body words versus paid raw frame');
    let written=0;while(written<actual.length)written+=writeSync(fd,actual,written,actual.length-written);
    frames++;
   },host.archive.compressedSha256);
   assert.equal(frames,1201);
   for(const key of ['entries','records','numericLeaves','decodedRecordSha256','binary64BeWordSha256','rawSha256']){
    assert.equal(recovered[key],host.recovery[key],'paid full recovery identity '+key);
   }
   fsyncSync(fd);
   result.scenes[scene]={bodyIds,frames,strideBytes:936,trace:{path:path.slice(root.length+1),...pin(path)},
    archive:{path:source.slice(root.length+1),...host.archive},recovery:recovered};
  }finally{closeSync(fd);}
  assert.equal(statSync(path).size,1201*936);
  put('progress.json',result,false);
 }
 for(const [path,expected]of Object.entries(readerInputs))assert.deepEqual(pin(join(root,path)),expected);
 assert.deepEqual(pin(campaignPath),result.qualification?{bytes:result.qualification.bytes,sha256:result.qualification.sha256}:null);
 assert.ok(Date.now()<deadline,'derived-data deadline');
 result.status='DERIVED_BODY_TRACES_FROM_COMPLETE_ORIGINAL_3600';
}catch(error){result.status='FIRST_FAILURE';result.error={name:error.name,message:error.message};process.exitCode=1;}
finally{put('result.json',result);}
