import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];assert(/^[a-z0-9-]+$/.test(id??''));
const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});const put=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const raw=x=>typeof x==='number'?{$f64le:(()=>{assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const decode=x=>x&&typeof x==='object'&&Object.hasOwn(x,'$f64le')?Buffer.from(x.$f64le,'hex').readDoubleLE():Array.isArray(x)?x.map(decode):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)])):x;
const cases=JSON.parse(readFileSync(resolve(home,'cases.json'))).cases;assert.equal(cases.length,16);
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const child=spawn(python,['-B',resolve(home,'reference.py'),'--serve','--input',resolve(home,'cases.json'),'--bank',resolve(out,'bank.json')],{cwd:root,stdio:['pipe','pipe','pipe']});
const queued=[],waiters=[];let childDone=false,stderr='',stdoutBytes=0,phase='reference-bank',failure=null,accepted=0;
const reader=createInterface({input:child.stdout});reader.on('line',line=>{stdoutBytes+=Buffer.byteLength(line)+1;assert(stdoutBytes<=32768);const item=JSON.parse(line);if(waiters.length)waiters.shift().resolve(item);else queued.push(item);});
child.stderr.on('data',chunk=>{stderr+=chunk.toString();if(Buffer.byteLength(stderr)>8192)child.kill('SIGTERM');});
const closed=new Promise(resolve=>child.on('close',(code,signal)=>{childDone=true;for(const w of waiters.splice(0))w.reject(Error('Oracle exited: '+code+' '+stderr));resolve({code,signal});}));
function next(){if(queued.length)return Promise.resolve(queued.shift());if(childDone)return Promise.reject(Error('Oracle closed '+stderr));return new Promise((resolve,reject)=>waiters.push({resolve,reject}));}
const sourceResults=[],counts={source:{calls:0,sqrt:0,hypot:0},native:{calls:0,sqrt:0,hypot:0}},audits=[];
const deadline=setTimeout(()=>child.kill('SIGTERM'),175000);
try{
  const bank=await next();put('reference-ready.json',bank);assert.equal(bank.status,'READY_BANK');
  for(const graph of ['source','native']){
    phase=graph+'-import';let api;
    if(graph==='source')api=await import(pathToFileURL(resolve(home,'build/source.mjs')));
    else{assert.equal(accepted,16);const [model,ccd,validation]=await Promise.all(['model-admission','ccd','validation'].map(n=>import(pathToFileURL(resolve(root,'packages/barocss-physics/dist',n+'.js')))));api={...model,...ccd,...validation};}
    for(const encoded of cases){
      phase=graph+'-'+encoded.id;const c=decode(encoded);
      const model=makeModel({revision:'g2-exact-geometry',gravityMps2:[0,0,0],parts:[dynamicPart('sphere',{kind:'sphere',radiusM:c.radius},{positionM:c.start},1,{ccd:true}),staticPart('box',{kind:'box',halfExtentsM:c.half},{positionM:c.boxCenter??[0,0,0]})]});
      const admitted=api.admitModel(model,{profile:'rigid-discrete-v1',fixedStepSeconds:1/60,broadPhase:'direct'}),profile=api.admitCcd(admitted.bodies,0,[0,0,0]);
      const previous=admitted.bodies[0],candidate=api.copyBody(previous);candidate.positionM=[...c.end];
      const before=raw({previous,candidate,fixtures:profile.fixtures}),sqrt=Math.sqrt,hypot=Math.hypot;let hit;
      Math.sqrt=(x)=>{counts[graph].sqrt++;return sqrt(x);};Math.hypot=(...xs)=>{counts[graph].hypot++;return hypot(...xs);};
      try{counts[graph].calls++;hit=api.sweepSphere(previous,candidate,profile.fixtures);}finally{Math.sqrt=sqrt;Math.hypot=hypot;}
      const after=raw({previous,candidate,fixtures:profile.fixtures});assert.deepEqual(after.previous,before.previous);assert.deepEqual(after.fixtures,before.fixtures);
      const nonPosition=structuredClone(after.candidate);nonPosition.positionM=before.candidate.positionM;assert.deepEqual(nonPosition,before.candidate);
      if(!hit)assert.deepEqual(after.candidate,before.candidate);else{
        const expected=c.start.map((v,i)=>v+(c.end[i]-v)*hit.toiFraction-hit.normalFixtureToBody[i]*1e-9);assert.deepEqual(raw(candidate.positionM),raw(expected));
      }
      const observed={id:c.id,start:encoded.start,end:encoded.end,half:encoded.half,radius:encoded.radius,hit:hit?raw({fraction:hit.toiFraction,normalLocal:hit.normalFixtureToBody}):null,
        ...(hit?{unbiasedCenterLocal:raw(c.start.map((v,i)=>v+(c.end[i]-v)*hit.toiFraction))}:{})};
      const packet={observed,before,after,facadeHit:raw(hit)};put(graph+'-'+c.id+'.json',packet);
      if(graph==='source')sourceResults.push(packet);else assert.deepEqual(packet,sourceResults[counts[graph].calls-1],'Source/Native raw parity');
      child.stdin.write(JSON.stringify({case:observed})+'\n');const audit=await next();put(graph+'-'+c.id+'-audit.json',audit);audits.push(audit);assert.equal(audit.status,'PASS_CASE',JSON.stringify(audit));assert.equal(audit.id,c.id);accepted++;
    }
  }
  phase='oracle-close';child.stdin.end();const exit=await closed;assert.equal(exit.code,0);assert.equal(exit.signal,null);assert.equal(accepted,32);
}catch(error){failure={phase,name:error.name,message:error.message,stack:error.stack};if(!childDone)child.stdin.end();}
finally{clearTimeout(deadline);if(!childDone){child.kill('SIGTERM');await closed;}writeFileSync(resolve(out,'reference.stderr'),stderr,{flag:'wx'});}
const bytes=JSON.stringify({sourceResults,audits,counts,failure}).length;assert(bytes<=1048576);const summary={status:failure?'FAIL_ROUNDED_GEOMETRY':'PASS_ROUNDED_GEOMETRY',counts,acceptedAudits:accepted,referenceCounts:audits.at(-1)?.counts??null,firstFailure:failure,referenceStdoutBytes:stdoutBytes,WorldCalls:0,browser:'NOT_RUN',publicAPI:'NOT_RUN'};put('summary.json',summary);console.log(JSON.stringify(summary));if(failure)process.exitCode=1;
