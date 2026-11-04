// One pending original Python request; every complete wire is stream archived.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const LINE=2**21,sha=b=>createHash('sha256').update(b).digest('hex');
export function reference({path,label,python,scene,deadline,archive,wire,onFailure}){
 const child=spawn(python,['-B',path],{stdio:['pipe','pipe','pipe']});
 let pending=null,partial=Buffer.alloc(0),error=null,stderrBytes=0,stderr=[],closed=false,closing=false,exit=null,signal=null,requests=0,replies=0,lastStep=0,pendingIdentity=null;const wireHash=createHash('sha256');
 let resolveClose;const closure=new Promise(r=>resolveClose=r);
 const reject=e=>{const first=!error;error??=e;if(pending){const p=pending;pendingIdentity={step:p.step,op:p.op,receiving:p.receiving};pending=null;clearTimeout(p.timer);p.reject(error);}if(first)onFailure?.(Object.assign(error,{unresolved:true}),pendingIdentity);};
 child.stderr.on('data',b=>{stderrBytes+=b.length;if(stderrBytes<=128*1024)stderr.push(b);reject(Error(label+' unexpected stderr'));});
 child.stdout.on('data',b=>{
  if(partial.length+b.length>LINE){partial=Buffer.concat([partial,b.subarray(0,Math.max(0,LINE-partial.length))]);reject(Error(label+' reply2MiB bound'));return;}
  partial=Buffer.concat([partial,b]);const end=partial.indexOf(10);if(end<0)return;
  const p=pending;if(!p||p.receiving){reject(Error(label+' unsolicited/trailing reply'));return;}p.receiving=true;
  const reply=partial.subarray(0,end+1);partial=partial.subarray(end+1);
  void(async()=>{try{
   assert.equal(partial.length,0,label+' trailing output');await archive.appendRpc(scene,p.step,p.op,'reply',reply);
   wireHash.update(p.step+':'+p.op+':reply:'+sha(reply)+'\n');const value=JSON.parse(reply.toString('utf8'));assert.equal(partial.length,0,label+' late trailing output');if(error)throw error;assert.equal(pending,p);pending=null;clearTimeout(p.timer);replies++;p.resolve({value,replySHA:sha(reply)});
  }catch(e){reject(e);p.reject(e);}})();
 });
 child.stdin.on('error',reject);child.on('error',reject);child.on('close',(code,sig)=>{closed=true;exit=code;signal=sig;if(pending||!closing)reject(Error(label+' unexpected/pending close'));resolveClose();});
 return {
  async ask(step,op,value){
   if(error)throw error;assert.ok(!closed);assert.equal(pending,null,'one outstanding per child');lastStep=step;const bytes=wire(value);await archive.appendRpc(scene,step,op,'request',bytes);wireHash.update(step+':'+op+':request:'+sha(bytes)+'\n');
   const remaining=Math.floor(deadline-Date.now());assert.ok(remaining>0,'scene170 remaining deadline');
   let p;const response=new Promise((resolve,rejectPromise)=>{p={step,op,resolve,reject:rejectPromise,receiving:false,timer:setTimeout(()=>reject(Object.assign(Error(label+' scene deadline'),{unresolved:true})),remaining)};pending=p;});
   // Install a rejection observer before awaiting stdin backpressure.
   response.catch(()=>{});requests++;
   try{const written=new Promise((resolve,rejectWrite)=>child.stdin.write(bytes,e=>e?rejectWrite(e):resolve()));await Promise.race([written,response.then(()=>written)]);return {...await response,requestSHA:sha(bytes)};}
   catch(e){reject(e);throw e;}
  },
  async close(failed){
   closing=true;if(!closed){if(failed||error)child.kill('SIGTERM');else child.stdin.end();let timer,kill=setTimeout(()=>child.kill('SIGKILL'),500);try{await Promise.race([closure,new Promise((_,r)=>{timer=setTimeout(()=>r(Error(label+' reap deadline')),1500);})]);}finally{clearTimeout(timer);clearTimeout(kill);}}
   const result={label,path,executable:python,pid:child.pid,requests,replies,closed,exit,signal,stderrBytes,trailingBytes:partial.length,error:error?.message??null,pendingIdentity,wireTranscriptSha256:wireHash.digest('hex')};
   // Partial/error buffers are returned once, for the bounded emergency archive.
   if(!failed){assert.equal(error,null);assert.equal(exit,0);assert.equal(signal,null);assert.equal(stderrBytes,0);assert.equal(partial.length,0);assert.equal(requests,replies);}
   return {receipt:result,partial,stderr:Buffer.concat(stderr),lastStep};
  }
 };
}
