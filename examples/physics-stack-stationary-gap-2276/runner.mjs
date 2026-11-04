// One cold, private GAP specimen. Root executes this file under its outer180s group.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const args=process.argv.slice(2);
assert.equal(args.length,2,'usage: runner.mjs --out ABSOLUTE_FRESH_OUTPUT');
assert.equal(args[0],'--out');
const out=args[1];
assert.ok(isAbsolute(out)&&resolve(out).startsWith(join(home,'evidence')+'/'),'owned evidence output required');
assert.ok(!existsSync(out),'fresh output required');
mkdirSync(dirname(out),{recursive:true});mkdirSync(out);
const start=process.hrtime.bigint(),deadline=Date.now()+170000;
const MiB=1024*1024,CAP=280*MiB,MAIN=270*MiB,META=8*MiB,EMERGENCY=2*MiB;
const pins=JSON.parse(readFileSync(join(home,'PINS.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const pinsSHA=digest(readFileSync(join(home,'PINS.json')));
function pin(name){
  const path=isAbsolute(name)?name:join(root,name),hash=createHash('sha256');
  const buffer=Buffer.alloc(65536),fd=openSync(path,'r');let bytes=0;
  try{let n;while((n=readSync(fd,buffer,0,buffer.length,null))){hash.update(buffer.subarray(0,n));bytes+=n;}}
  finally{closeSync(fd);}
  return {bytes,sha256:hash.digest('hex')};
}
function authenticate(){
  assert.equal(digest(readFileSync(join(home,'PINS.json'))),pinsSHA,'PINS changed');
  for(const [name,expected] of Object.entries(pins.files))assert.deepEqual(pin(name),expected,'SOURCE_PIN:'+name);
  assert.equal(resolve(process.execPath),pins.node,'pinned Node');
  assert.ok(Date.now()<deadline,'inner170s admission');
}
let mainBytes=0,metadataBytes=0,emergencyBytes=0;
function save(name,b,kind='main'){
  assert.ok(Buffer.isBuffer(b));
  assert.equal(dirname(name),out,'flat owned output only');
  const used=kind==='main'?mainBytes:kind==='metadata'?metadataBytes:emergencyBytes;
  const limit=kind==='main'?MAIN:kind==='metadata'?META:EMERGENCY;
  assert.ok(used+b.length<=limit&&mainBytes+metadataBytes+emergencyBytes+b.length<=CAP,'shared280MiB reservation');
  writeFileSync(name,b,{flag:'wx'});
  if(kind==='main')mainBytes+=b.length;else if(kind==='metadata')metadataBytes+=b.length;else emergencyBytes+=b.length;
}
const budget={save};
let io,words,geometry,position,writer,input,prepared,record,firstFailure=null,stage='authenticate-before';
let calls=0,accepted=0,recovery=null,authenticationAfter=false,inputRetained=false,cleanup=[];
function errorData(e){return {stage,errorClass:e?.name??'Error',code:e?.code??null,message:String(e?.message??e)};}
function resolved(value,label){assert.equal(value.resolved,true,label+' unresolved');assert.notEqual(value.executionFailure,true,label+' execution failure');assert.deepEqual(value.violations,[],label+' violations');}
function state(bodies,step,contacts=[]){return {bodies,contacts,stepIndex:step,timeSeconds:step*(1/120)};}
function restore(value,hex){
  const b=Buffer.from(hex,'hex');let offset=0;
  function visit(v){
    if(typeof v==='number'){
      assert.ok(offset+8<=b.length);const n=b.readDoubleLE(offset);offset+=8;
      assert.ok(Number.isFinite(n)&&(n===v),'recovered nonzero numeric mismatch');return n;
    }
    if(Array.isArray(v))return v.map(visit);
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x)]));
    return v;
  }
  const result=visit(value);assert.equal(offset,b.length);return result;
}
function archiveAndRecover(value,frames){
  const hex=words.numericWordsHex(value);
  budget.save(join(out,'record-words.f64le'),Buffer.from(hex,'hex'));
  writer.write(value,frames);
  const decoded=gunzipSync(readFileSync(join(out,'step-0.jsonl.gz')),{maxOutputLength:4*MiB});
  const restored=restore(JSON.parse(decoded.toString('utf8')),hex);
  assert.deepEqual(restored,value,'all finite record fields and signed zeros recovered');
  assert.equal(words.numericWordsHex(restored),hex);
  const rawRecovered=gunzipSync(readFileSync(join(out,'step-0.f64le.gz')),{maxOutputLength:16*MiB});
  const expectedRaw=Buffer.concat(frames.map(io.raw));assert.deepEqual(rawRecovered,expectedRaw);
  return {allRecordWordsRecovered:true,numericWords:hex.length/16,recordWordSha256:digest(Buffer.from(hex,'hex')),rawBytes:rawRecovered.length,rawSha256:digest(rawRecovered),frames:frames.length};
}
try{
  authenticate();
  const snapshot=join(root,pins.canonical);
  const load=p=>import(pathToFileURL(join(snapshot,p)).href);
  const {prepareStackStep}=await load('canonical-provider/dist/stack/prepare-step.js');
  const {parseBody}=await load('canonical-provider/dist/validation.js');
  const {fixture}=await load('test-helpers/examples/physics-rigid-contact-reference/fixtures.mjs');
  const {verifyNormalKkt}=await load('test-helpers/examples/physics-stack-solver-2276/verification.js');
  io=await load('test-helpers/examples/physics-stack-library-2276/io.mjs');
  words=await load('test-helpers/examples/physics-stack-stationary-library-2276/witness-wire.mjs');
  writer=io.archive(out,'step',budget);
  stage='authored-gap-input';
  const config=fixture('ALIGNED'),original=structuredClone(config);
  for(const body of config.bodies)if(body.kind==='dynamic')body.positionM[1]+=.0001;
  assert.deepEqual(config.bodies.filter(b=>b.kind==='static'),original.bodies.filter(b=>b.kind==='static'));
  input=config.bodies.map(body=>parseBody(body));
  const retained=structuredClone(input),inputWords=words.numericWordsHex(input);
  for(const body of input){assert.ok(body.velocityMps.every(v=>v===0)&&body.angularVelocityRadps.every(v=>v===0));}
  record={kind:'GAP_PRIVATE_ONE_STEP',scene:'ALIGNED',step:1,mutation:'each authored dynamic positionM[1] += .0001 (JS Number)',originalConfig:original,config,input};
  stage='one-cold-prepare';calls++;
  try{prepared=prepareStackStep(input,1/120,[0,-9.81,0]);}
  catch(e){record.prepareFailure={...errorData(e),diagnostics:e?.diagnostics??null};throw e;}
  finally{assert.deepEqual(input,retained,'cold prepare input retention');assert.equal(words.numericWordsHex(input),inputWords,'input raw words retained');inputRetained=true;}
  record.prepared=prepared;
  stage='candidate-linkage';
  const d=prepared.diagnostics,p=d.positionAttempt,w=d.stationaryNormalWitness,s=d.positionStats;
  assert.equal(w.ok,true);assert.equal(w.status,'SOLVED_STATIONARY_WITNESS');
  assert.equal(d.pointLedger.length,32);assert.equal(d.normalProblem.points.length,32);
  assert.equal(p.problem.rows.length,36);assert.equal(p.rowSources.length,36);
  for(const key of ['tests','rows','postPairTests'])assert.equal(s[key],36);
  assert.equal(s.solverCalls,1);assert.equal(s.workingApplicationCount,1);
  assert.equal(words.numericWordsHex(d.beforeBodies),inputWords);
  assert.equal(io.raw(p.preBodies).toString('hex'),io.raw(d.velocityBodies).toString('hex'),'position input linkage');
  assert.equal(io.raw(p.hypotheticalBodies).toString('hex'),io.raw(prepared.candidateBodies).toString('hex'),'position candidate linkage');
  const shared=bs=>bs.map(b=>[b.positionM,b.velocityMps,b.angularVelocityRadps,b.inverseMass]);
  assert.deepEqual(w.bodies.map(b=>b.id),d.velocityBodies.map(b=>b.id));
  assert.deepEqual(w.bodies.map(b=>b.id),d.normalResult.bodies.map(b=>b.id));
  assert.equal(words.numericWordsHex(shared(w.bodies)),words.numericWordsHex(shared(d.velocityBodies)));
  assert.equal(words.numericWordsHex(shared(w.bodies)),words.numericWordsHex(shared(d.normalResult.bodies)));
  assert.equal(words.numericWordsHex(w.normalImpulsesNs),words.numericWordsHex(d.normalResult.normalImpulsesNs));
  assert.equal(words.numericWordsHex(w.normalImpulsesNs),words.numericWordsHex(d.pointLedger.map(x=>x.final.normalNs)));
  const ids=d.normalProblem.points.map(x=>x.id);
  assert.deepEqual(w.exactApplied.points.map(x=>x.id),ids);
  assert.deepEqual(d.pointLedger.map(x=>JSON.stringify([x.pairKey,x.pointId])),ids);
  for(const x of d.pointLedger){assert.equal(x.warm.normalNs,0);assert.deepEqual(x.warm.tangentNs,[0,0,0]);assert.deepEqual(x.final.tangentNs,[0,0,0]);}
  const displacements=[];
  for(let i=0;i<input.length;i++){
    assert.equal(input[i].id,prepared.candidateBodies[i].id);
    if(input[i].kind==='static')assert.equal(words.numericWordsHex(prepared.candidateBodies[i]),words.numericWordsHex(input[i]));
    else displacements.push({id:input[i].id,beforeY:input[i].positionM[1],candidateY:prepared.candidateBodies[i].positionM[1],deltaY:prepared.candidateBodies[i].positionM[1]-input[i].positionM[1]});
  }
  assert.equal(displacements.length,8);assert.ok(displacements.some(x=>x.deltaY!==0),'actual nonzero candidate Y displacement required');
  const frames=[input,d.beforeBodies,d.freeBodies,d.velocityBodies,p.preBodies,p.hypotheticalBodies,prepared.candidateBodies];
  const frameNames=['INPUT','BEFORE','FREE','VELOCITY','POSITION_PRE','POSITION_HYP','CANDIDATE'];
  record.displacements=displacements;
  record.frameLayouts=frameNames.map((name,i)=>({name,bytes:io.raw(frames[i]).length,sha256:digest(io.raw(frames[i])),bodyIds:frames[i].map(b=>b.id)}));
  const pointBytes=Buffer.alloc(d.normalProblem.points.length*48);let k=0;
  for(const x of d.normalProblem.points)for(const n of [...x.pointM,...x.normalAtoB]){pointBytes.writeDoubleLE(n,k);k+=8;}
  record.pointOperandF64leHex=pointBytes.toString('hex');
  record.velocityCheck=verifyNormalKkt(d.normalProblem,d.normalResult);assert.equal(record.velocityCheck.passed,true);
  geometry=io.observer(join(root,pins.geometry),out,'geometry',deadline,budget,pins.python);
  position=io.observer(join(root,pins.position),out,'position',deadline,budget,pins.python);
  const initial=state(input,0);
  stage='initial-quality';record.initialQuality=await geometry.ask({op:'quality',request:{state:initial,initial,timeSeconds:0,referenceAt8s:null}});resolved(record.initialQuality,stage);
  stage='contacts';record.contactGeometry=await geometry.ask({op:'contacts',freeBodies:d.freeBodies,pointLedger:d.pointLedger});resolved(record.contactGeometry,stage);assert.equal(record.contactGeometry.ok,true);
  stage='position-world-and-fraction';
  record.positionCheck=await position.ask({op:'world',scene:'ALIGNED',stepIndex:1,config,stationaryNormalWitnessCheck:words.packWitness(d.normalProblem,w),preBodies:p.preBodies,preRawHex:io.raw(p.preBodies).toString('hex'),problem:p.problem,rowSelections:p.rowSources,result:p.result,hypBodies:p.hypotheticalBodies,hypRawHex:io.raw(p.hypotheticalBodies).toString('hex')});
  resolved(record.positionCheck,stage);resolved(record.positionCheck.stationaryNormalWitnessCheck,'Fraction');assert.equal(record.positionCheck.stationaryNormalWitnessCheck.ok,true);
  assert.ok(record.positionCheck.metrics.maxHypDepthRawM<=1e-12&&record.positionCheck.metrics.maxHypDepthNormalizedM<=1e-12);
  stage='step-ledger';
  record.ledgerCheck=await position.ask({op:'step-ledger',scene:'ALIGNED',stepIndex:1,outcome:'accepted',ledger:{beforeBodies:d.beforeBodies,freeBodies:d.freeBodies,velocityBodies:d.velocityBodies,finalBodies:prepared.candidateBodies,points:d.pointLedger,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],actions:[]},raw:{before:io.raw(d.beforeBodies).toString('hex'),free:io.raw(d.freeBodies).toString('hex'),velocity:io.raw(d.velocityBodies).toString('hex'),final:io.raw(prepared.candidateBodies).toString('hex')}});resolved(record.ledgerCheck,stage);
  stage='post-quality';
  record.after=state(prepared.candidateBodies,1,d.geometryPatches.map(({aId,bId})=>({aId,bId})));
  record.quality=await geometry.ask({op:'quality',request:{state:record.after,initial,timeSeconds:1/120,referenceAt8s:null}});resolved(record.quality,stage);
  assert.equal(words.numericWordsHex(input),inputWords,'input retained after all observers');
  stage='archive-and-recover';recovery=archiveAndRecover(record,frames);
}catch(e){firstFailure=errorData(e);}
finally{
  if(firstFailure&&record&&writer&&!recovery){
    try{record.firstFailure=firstFailure;recovery=archiveAndRecover(record,prepared?[input,prepared.candidateBodies]:[input]);}
    catch(e){firstFailure.archiveFailure=String(e?.message??e);}
  }
  for(const ref of [geometry,position])if(ref)try{cleanup.push(await ref.close(firstFailure!==null));}catch(e){firstFailure??=errorData(e);cleanup.push({cleanupFailure:String(e?.message??e)});}
  try{stage='authenticate-after';authenticate();authenticationAfter=true;}catch(e){firstFailure??=errorData(e);}
  // Frozen observer writes tiny process receipts directly. Charge those after clean reap.
  try{
    const direct=readdirSync(out).filter(n=>n.endsWith('-process.json')).reduce((n,f)=>n+statSync(join(out,f)).size,0);
    assert.ok(metadataBytes+direct<=META);metadataBytes+=direct;
    assert.ok(mainBytes+metadataBytes+emergencyBytes<=CAP);
    assert.ok(Date.now()<deadline,'inner170s including clean reap/recovery/authentication');
    if(!firstFailure){assert.equal(calls,1);assert.equal(cleanup.length,2);accepted=1;}
  }catch(e){firstFailure??=errorData(e);}
  const receipt={status:firstFailure?'FIRST_NO_GO':'PASS_PRIVATE_GAP_ONE_STEP',scope:'ONE_PRIVATE_COLD_INPUT_NOT_PUBLIC_WORLD_NOT_TRAJECTORY',pinsSHA,providerDigest:pins.providerDigest,firstFailure,actualPrepareCalls:calls,accepted,nonzeroYDisplacement:record?.displacements?.some(x=>x.deltaY!==0)??false,displacements:record?.displacements??null,inputRetained,authenticationAfter,cleanup,recovery,archive:writer?.finish()??null,output:{cap:CAP,mainLimit:MAIN,metadataReserve:META,emergencyReserve:EMERGENCY,mainBytes,metadataBytes,emergencyBytes},innerWallBeforeFinalReceiptSeconds:Number(process.hrtime.bigint()-start)/1e9,publicWorld:'NOT_RUN',rollback:'NOT_RUN',trajectory:'NOT_RUN',full1200:'NOT_RUN',ownedCPU:'NOT_QUALIFIED_BY_THIS_RUNNER',RSS:'NOT_ADMITTED_OR_CAPPED'};
  const b=Buffer.from(JSON.stringify(receipt,null,2)+'\n');
  save(join(out,'result.json'),b,firstFailure?'emergency':'metadata');
  process.stdout.write(JSON.stringify({status:receipt.status,result:relative(root,join(out,'result.json')),accepted,firstFailure})+'\n');
  if(firstFailure)process.exitCode=1;
}
