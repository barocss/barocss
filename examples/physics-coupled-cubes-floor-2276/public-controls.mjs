// Root executes after actual public32. No build, production hooks or alternative provider.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,copyFileSync,existsSync,mkdirSync,openSync,readSync,closeSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const home=import.meta.dirname,root=resolve(home,'../..');
const [sourceArg,nativeArg,id,flag,paidArg]=process.argv.slice(2);
assert.equal(process.argv.length,7,'node public-controls.mjs SOURCE_DIR NATIVE_DIST FRESH_ID --public32 RESULT_JSON');
assert.equal(flag,'--public32');assert.match(id??'',/^[a-z0-9-]+$/);
assert.ok([sourceArg,nativeArg,paidArg].every(value=>isAbsolute(value??'')),'explicit absolute input paths');
const source=resolve(sourceArg),native=resolve(nativeArg),paidPath=resolve(paidArg),paidHome=dirname(paidPath);
const out=join(home,'evidence',id);assert.ok(!existsSync(out),'fresh output');mkdirSync(dirname(out),{recursive:true});mkdirSync(out);
const deadline=Date.now()+170000,CAP=16*1024*1024,LINE=2*1024*1024;
const charges={source:0,native:0},frozen={},reports={};let graph='source',stage='authenticate',failure=null,currentOwner=null;
function pin(path){const h=createHash('sha256'),b=Buffer.alloc(65536),fd=openSync(path,'r');let bytes=0;try{let n;while((n=readSync(fd,b,0,b.length,null))){h.update(b.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}return{bytes,sha256:h.digest('hex')};}
function freeze(path,expected){const actual=pin(path);if(expected)assert.equal(actual.sha256,expected,path);frozen[path]=actual;return actual;}
function inventory(dir){const files={};function visit(at){for(const d of readdirSync(at,{withFileTypes:true})){const path=join(at,d.name);assert.ok(!d.isSymbolicLink(),'provider symlink refused');if(d.isDirectory())visit(path);else files[relative(dir,path)]=pin(path);}}visit(dir);return files;}
function time(){assert.ok(Date.now()<deadline,'internal170s deadline');}
function words(value){const list=[];let nodes=0;function visit(x,depth){assert.ok(++nodes<=262144&&depth<=64);if(typeof x==='number'){assert.ok(Number.isFinite(x)&&list.length<65536);const b=Buffer.alloc(8);b.writeDoubleLE(x);list.push(b);return;}if(Array.isArray(x)){for(const v of x)visit(v,depth+1);}else if(x&&typeof x==='object')for(const key of Object.keys(x))visit(x[key],depth+1);}visit(value,0);return Buffer.concat(list);}
function encode(value){const wire=Buffer.from(JSON.stringify(value)+'\n');assert.ok(wire.length<=LINE,'2MiB complete evidence line');return wire;}
function put(name,value){const b=Buffer.isBuffer(value)?value:encode(value);assert.ok(charges[graph]+b.length<=CAP,'16MiB graph evidence');charges[graph]+=b.length;writeFileSync(join(out,name),b,{flag:'wx'});}
function capture(value){return{data:value,numericWordsF64leHex:words(value).toString('hex')};}
function restore(packet){const b=Buffer.from(packet.numericWordsF64leHex,'hex');assert.ok(b.length<=512*1024);let at=0;function visit(x){if(typeof x==='number'){assert.ok(at+8<=b.length);const n=b.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(n)&&n===x);return n;}if(Array.isArray(x))return x.map(visit);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v)]));return x;}const result=visit(packet.data);assert.equal(at,b.length);return result;}
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'&&typeof v==='string'?'DECLARED_GRAPH_DIGEST':normalize(v)])):x;
function same(actual,expected,label){assert.deepEqual(normalize(actual),normalize(expected),label);assert.deepEqual(words(actual),words(expected),label+' all Number words');}
function snapshot(w,r){return{state:w.getState(),model:w.getModel(),recording:r?r.saveRecording():null};}
function retention(w,r,before,command,commandBefore){same(snapshot(w,r),before,'complete owner retained');assert.deepEqual(command,commandBefore);assert.deepEqual(words(command),words(commandBefore));}
function event(state,phase){const contacts=state.contacts;assert.ok(contacts.length>0);for(const c of contacts)assert.ok(state.events.some(e=>e.kind==='contact'&&e.colliderAId===c.colliderAId&&e.colliderBId===c.colliderBId&&e.phase===phase),'actual contact '+phase+' event');}
function serializeError(error){return{name:error?.name??typeof error,code:error?.code??null,message:String(error?.message??error),details:error?.details??null};}
const originalPins={},copyPins={};
function authenticate(){for(const[path,expected]of Object.entries(frozen))assert.deepEqual(pin(path),expected,'frozen input '+path);for(const[path,expected]of Object.entries(copyPins))assert.deepEqual(pin(path),expected,'instrumented copy '+path);time();}
try{
 assert.equal(process.versions.node,'22.19.0');freeze(process.execPath,'0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1');freeze(import.meta.filename);
 freeze(paidPath,'c5088fe47822b2c62f5b3737db1cf68c363116406a20e01e21274fbe37354cca');
 const paid=JSON.parse(readFileSync(paidPath,'utf8'));assert.equal(paid.status,'COUPLED_PUBLIC32_SOURCE_NATIVE_CONFIRMED');assert.equal(paid.sourceIntegrity,'PASS');assert.equal(paid.fatal,null);
 assert.equal(dirname(paid.sourceEntry),source);assert.equal(dirname(paid.nativeEntry),native);
 for(const name of ['source','native']){const r=paid.reports[name];assert.equal(r.status,'PUBLIC32_PREFIX_PHYSICS_CONFIRMED');assert.equal(r.worlds,1);assert.equal(r.acceptedSteps,32);assert.equal(r.passedPrefixSteps,32);assert.equal(r.firstFailure,null);}
 const buildPath=resolve(paid.buildManifest);freeze(buildPath);const build=JSON.parse(readFileSync(buildPath,'utf8'));
 assert.equal(build.status,'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');assert.equal(build.sourceIntegrity,true);assert.equal(build.firstFailure,null);
 for(const group of [build.sourcePins,build.nativePins])for(const[name,sha]of Object.entries(group))freeze(resolve(root,name),sha);
 const authority={};
 for(const name of ['source','native']){
  authority[name]={};
  for(const step of [1,5]){const path=join(paidHome,name+'-prefix-'+step+'.json');freeze(path);const p=JSON.parse(readFileSync(path,'utf8')),data=restore(p);assert.equal(data.states.length,step+1);authority[name][step]=data;}
 }
 for(const[name,dir]of [['source',source],['native',native]]){originalPins[name]=inventory(dir);for(const[file,p]of Object.entries(originalPins[name]))freeze(join(dir,file),p.sha256);}
 put('inputs.json',{frozen,paidPublic32:paidPath,source,native,bounds:{worldAttempts:12,worlds:12,successfulReturnedSteps:64,evidenceBytesPerGraph:CAP,lineBytes:LINE,innerMs:170000,outerMs:180000},scope:'ORDINARY_CONTROLS_PLUS_SEPARATE_UNTRUSTED_PROVIDER_COPY'});
 for(const [name,dir]of [['source',source],['native',native]]){
  graph=name;time();stage=name+'-import';const api={...await import(pathToFileURL(join(dir,'index.js'))),...await import(pathToFileURL(join(dir,'replay.js')))};
  const input=authority[name][1],literalModel=input.model,literalOptions=input.options;
  const count={creationAttempts:0,worlds:0,stepAttempts:0,successfulReturnedSteps:0,knownRefusals:0,naturalRefusals:0,admissionRefusals:0,unknownThrows:0,paidStateComparisons:0};
  const report=reports[name]={status:'RUNNING',count,cases:[],diagnosticCopyUntrustedIdentity:true};
  const owned=[];
  const open=(provider,model,options)=>{time();assert.ok(count.creationAttempts<12);count.creationAttempts++;const w=provider.createPhysicsWorld(model,options);count.worlds++;assert.ok(count.worlds<=12);owned.push(w);currentOwner={w,r:null};return w;};
  const step=(actor,command=[])=>{time();assert.ok(count.successfulReturnedSteps<64);count.stepAttempts++;const state=actor.step(command);count.successfulReturnedSteps++;return state;};
  const comparePaid=(state,index)=>{same(state,authority[name][index].states[index],'actual paid state '+index);count.paidStateComparisons++;};
  try{
   for(const mode of ['record','step']){
    stage=name+'-known-'+mode;const model=structuredClone(literalModel),authored=structuredClone(model),w=open(api,model,literalOptions),r=mode==='record'?api.createPhysicsRecorder(w):null;if(r)owned.push(r);currentOwner={w,r};
    const actor=r??w;for(let n=1;n<=4;n++){const state=step(actor);event(state,n===1?'begin':'stay');}
    const before=snapshot(w,r),command=[{kind:'impulse',bodyId:'upper',impulseNs:[0,100000,0]}],savedCommand=structuredClone(command);
    let caught=false;try{step(actor,command);}catch(error){caught=true;assert.ok(error instanceof api.PhysicsError);assert.equal(error.code,'NUMERIC_LIMIT');assert.equal(error.details.operation,mode);assert.equal(error.details.phase,'candidate');assert.deepEqual(error.details.accepted,{stepIndex:4,timeSeconds:4/120});count.knownRefusals++;}
    assert.ok(caught,'admissible impulse must reach numeric FREE movement refusal');retention(w,r,before,command,savedCommand);
    put(name+'-known-'+mode+'.json',capture({before,after:snapshot(w,r),command,details:{operation:mode,acceptedStep:4,reason:'100000Ns parsed but FREE movement exceeds10m'}}));
    const retry=step(actor);comparePaid(retry,5);event(retry,'stay');assert.equal(retry.stepIndex,5);if(r)assert.equal(r.saveRecording().frames.length,5);
    assert.deepEqual(model,authored);report.cases.push({name:'known-'+mode,retained:true,retryPaidStep:5});currentOwner=null;
   }
   for(const mode of ['record','step']){
    stage=name+'-natural-anisotropic-'+mode;const model=structuredClone(literalModel);model.revision='coupled-natural-anisotropic-refusal-v1';
    const body=model.bodies.find(b=>b.id==='upper'),collider=model.colliders.find(c=>c.bodyId===body.id);
    body.initial.positionM=[0,5,0];body.initial.orientationXYZW=[.1,.2,.3,Math.sqrt(.86)];collider.geometry.halfExtentsM=[.25,.5,.75];
    const authored=structuredClone(model),w=open(api,model,literalOptions),r=mode==='record'?api.createPhysicsRecorder(w):null;if(r)owned.push(r);currentOwner={w,r};
    const before=snapshot(w,r),command=[],savedCommand=structuredClone(command);let caught=false,observed=null;
    try{step(r??w,command);}catch(error){caught=true;observed=serializeError(error);assert.ok(error instanceof api.PhysicsError);assert.equal(error.code,'NUMERIC_LIMIT');assert.equal(error.details.operation,mode);assert.equal(error.details.phase,'candidate');assert.deepEqual(error.details.accepted,{stepIndex:0,timeSeconds:0});assert.match(error.message,/symmetric inertia required/,'natural input must exercise actual tensor route');count.naturalRefusals++;}
    assert.ok(caught,'fixed natural anisotropic input did not exercise claimed refusal; preserve first result without fixture search');
    retention(w,r,before,command,savedCommand);assert.deepEqual(model,authored);put(name+'-natural-'+mode+'.json',capture({authoredModel:model,before,after:snapshot(w,r),observed}));
    report.cases.push({name:'natural-anisotropic-'+mode,retained:true,observed});currentOwner=null;
   }
   for(const kind of ['aabb','five-bodies']){
    stage=name+'-admission-'+kind;const model=structuredClone(literalModel),options=structuredClone(literalOptions);
    if(kind==='aabb')options.broadPhase='aabb';
    else for(const [i,bid]of ['extra-a','extra-b'].entries()){const b=structuredClone(model.bodies.find(x=>x.id==='upper')),c=structuredClone(model.colliders.find(x=>x.bodyId==='upper'));b.id=bid;b.initial.positionM=[4+2*i,5,0];c.id=bid+'.shape';c.bodyId=bid;model.bodies.push(b);model.colliders.push(c);}
    const before=structuredClone({model,options});let caught=false;
    try{open(api,model,options);}catch(error){caught=true;assert.ok(error instanceof api.PhysicsError);assert.equal(error.code,'INVALID_CONFIG');if(kind==='aabb')assert.match(error.message,/frictionless island requires direct broadPhase/);count.admissionRefusals++;}
    assert.ok(caught,'unsupported admission must not select legacy route');assert.deepEqual({model,options},before);
    report.cases.push({name:'admission-'+kind,code:'INVALID_CONFIG',inputRetained:true});
   }
   stage=name+'-make-diagnostic-copy';const copy=join(out,name+'-provider-copy'),files=originalPins[name];
   let copyBytes=Object.values(files).reduce((n,p)=>n+p.bytes,0);const packagePath=join(dir,'package.json'),parentPackage=join(dirname(dir),'package.json');
   if(!existsSync(packagePath)){freeze(parentPackage);copyBytes+=pin(parentPackage).bytes;}
   assert.ok(charges[name]+copyBytes<=CAP,'full copied closure charged before allocation');charges[name]+=copyBytes;cpSync(dir,copy,{recursive:true});
   if(!existsSync(join(copy,'package.json')))copyFileSync(parentPackage,join(copy,'package.json'));
   const needle='prepareFrictionlessIsland(next, pairs, { jointCount: joints.length });';
   const injection="\nif (globalThis.__coupledPublicControlsFault) { const exampleFault = globalThis.__coupledPublicControlsFault; globalThis.__coupledPublicControlsFault = null; exampleFault.seen++; throw exampleFault.value; }\n";
   const changes=[];
   for(const file of ['world.js','index.js']){const path=join(copy,file);if(!existsSync(path))continue;const text=readFileSync(path,'utf8'),countNeedles=text.split(needle).length-1;if(!countNeedles)continue;assert.equal(countNeedles,1,'unique actual island call statement');const transformed=text.replace(needle,needle+injection);const delta=Buffer.byteLength(transformed)-Buffer.byteLength(text);assert.ok(charges[name]+delta<=CAP);charges[name]+=delta;writeFileSync(path,transformed);changes.push({file,originalSHA256:pin(join(dir,file)).sha256,instrumentedSHA256:pin(path).sha256,exactNeedle:needle});}
   assert.ok(changes.length>=1&&changes.length<=2);for(const[file,p]of Object.entries(inventory(copy)))copyPins[join(copy,file)]=p;
   put(name+'-diagnostic-copy.json',{identityScope:'UNTRUSTED_TEST_COPY_ONLY_NOT_CANONICAL_PASS',source:dir,copy,changes,allCopyPins:inventory(copy)});
   const diagnostic={...await import(pathToFileURL(join(copy,'index.js'))),...await import(pathToFileURL(join(copy,'replay.js')))};
   for(const kind of ['Error','object','null']){
    stage=name+'-unknown-'+kind;const w=open(diagnostic,structuredClone(literalModel),literalOptions),r=diagnostic.createPhysicsRecorder(w);owned.push(r);currentOwner={w,r};
    const before=snapshot(w,r),command=[],savedCommand=structuredClone(command);
    const marker={value:kind==='Error'?Error('UNTRUSTED_AFTER_ISLAND_PREPARE'):kind==='object'?{tag:'UNTRUSTED_AFTER_ISLAND_PREPARE'}:null,seen:0};
    assert.equal(globalThis.__coupledPublicControlsFault??null,null);globalThis.__coupledPublicControlsFault=marker;let caught=false;
    let consumed=false;
    try{step(r,command);}catch(error){caught=true;put(name+'-unknown-'+kind+'-thrown.json',{observed:serializeError(error),expectedIdentity:error===marker.value,seen:marker.seen});assert.equal(error,marker.value,'unknown thrown identity');count.unknownThrows++;}
    finally{consumed=globalThis.__coupledPublicControlsFault===null;delete globalThis.__coupledPublicControlsFault;}
    assert.equal(consumed,true,'one-shot fault consumed');
    assert.ok(caught);assert.equal(marker.seen,1,'actual island prepare returned before exactly one injected throw');retention(w,r,before,command,savedCommand);
    put(name+'-unknown-'+kind+'.json',capture({before,after:snapshot(w,r),command,seen:marker.seen,identityScope:'UNTRUSTED_TEST_COPY_ONLY'}));
    const retry=step(r);comparePaid(retry,1);event(retry,'begin');assert.equal(r.saveRecording().frames.length,1);
    report.cases.push({name:'unknown-'+kind,retained:true,retryPaidStep:1,identityScope:'UNTRUSTED_DIAGNOSTIC_COPY'});currentOwner=null;
   }
   assert.deepEqual(count,{creationAttempts:9,worlds:7,stepAttempts:20,successfulReturnedSteps:13,knownRefusals:2,naturalRefusals:2,admissionRefusals:2,unknownThrows:3,paidStateComparisons:5});
   report.status='PUBLIC_FAILURE_CONTROLS_CONFIRMED_WITH_SEPARATE_DIAGNOSTIC_COPY';
  }catch(error){failure??={stage,...serializeError(error)};report.status='FIRST_FAILURE';report.firstFailure=failure;throw error;}
  finally{
   delete globalThis.__coupledPublicControlsFault;
   try{if(currentOwner)put(name+'-reached-owner.json',capture(snapshot(currentOwner.w,currentOwner.r)));}
   catch(error){failure??={stage:name+'-owner-capture',...serializeError(error)};report.ownerCaptureFailure=serializeError(error);}
   for(const item of owned.reverse())try{item.dispose();}catch(error){failure??={stage:name+'-dispose',...serializeError(error)};(report.cleanupFailures??=[]).push(serializeError(error));}
   currentOwner=null;
  }
  put(name+'-result.json',report);
 }
 authenticate();
}catch(error){failure??={stage,...serializeError(error)};}
finally{
 try{authenticate();}catch(error){failure??={stage:'final-authentication',...serializeError(error)};}
 const result={status:failure?'FIRST_FAILURE':'PUBLIC_CONTROLS_SOURCE_NATIVE_CONFIRMED',firstFailure:failure,reports,
  source,native,paidPublic32:paidPath,chargesBeforeFinalReceipt:charges,limitPerGraph:CAP,
  ordinaryAndUntrustedCopyClaimsSeparated:true,buildCalls:0,oracleCalls:0,restoreCalls:0,desktop:'NOT_RUN',mobile:false,publication:false};
 put('result.json',result);process.stdout.write(JSON.stringify({status:result.status,firstFailure:failure,result:join(out,'result.json')})+'\n');if(failure)process.exitCode=1;
}
