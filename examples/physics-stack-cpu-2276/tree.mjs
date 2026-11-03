// Fixed synthetic Node + one joined Worker + three inherited Python children.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Worker,isMainThread,parentPort,workerData,threadId} from 'node:worker_threads';
const protocol='stack-cpu-synthetic-v1';
function spin(ms){const until=performance.now()+ms;let value=0;while(performance.now()<until)value=(value+1)|0;return value;}
if(!isMainThread){
 assert.equal(workerData,'fixed20ms');spin(20);
 parentPort.postMessage({pid:process.pid,threadId});parentPort.close();
}else{
 const [python,leaf,pgidText]=process.argv.slice(2),pgid=Number(pgidText);
 assert.ok(python?.startsWith('/')&&leaf?.startsWith('/')&&Number.isSafeInteger(pgid)&&pgid>1);
 const roles=['geometry','position0','position1'],children=[];let stopping=false;
 const worker=new Worker(new URL(import.meta.url),{workerData:'fixed20ms'});
 let workerMessage=null;
 const workerClosed=new Promise((resolve,reject)=>{worker.on('message',m=>{assert.equal(workerMessage,null);workerMessage=m;});worker.on('error',reject);worker.on('exit',exit=>resolve({...(workerMessage??{}),exit,joined:true}));});
 const completed=roles.map(role=>{
  const child=spawn(python,['-B',leaf,role],{detached:false,stdio:['ignore','pipe','pipe']});children.push(child);
  return new Promise((resolve,reject)=>{
   const stdout=[],stderr=[];let outBytes=0,errBytes=0,done=false;
   child.stdout.on('data',b=>{outBytes+=b.length;if(outBytes>4096){child.kill('SIGTERM');reject(Error('PYTHON_STDOUT_BOUND'));}else stdout.push(b);});
   child.stderr.on('data',b=>{errBytes+=b.length;if(errBytes>4096){child.kill('SIGTERM');reject(Error('PYTHON_STDERR_BOUND'));}else stderr.push(b);});
   child.on('error',reject);child.on('close',(closeCode,closeSignal)=>{
    if(done)return;done=true;
    try{
     assert.equal(closeCode,0);assert.equal(closeSignal,null);assert.equal(errBytes,0);assert.ok(outBytes<=4096);
     const text=Buffer.concat(stdout).toString('utf8');assert.ok(text.endsWith('\n')&&text.indexOf('\n')===text.length-1);
     const value=JSON.parse(text);assert.equal(value.protocol,protocol);assert.equal(value.role,role);assert.equal(value.pid,child.pid);assert.equal(value.ppid,process.pid);assert.equal(value.pgid,pgid);assert.deepEqual(value.children,[]);assert.equal(value.allReaped,true);
     resolve({...value,closeCode,closeSignal,stdoutEof:true});
    }catch(error){reject(error);}
   });
  });
 });
 console.log(JSON.stringify({protocol,kind:'started-tree',pid:process.pid,ppid:process.ppid,pgid,childPids:children.map(c=>c.pid)}));
 const stop=()=>{if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');void worker.terminate();};
 process.on('SIGTERM',stop);
 const timer=setTimeout(stop,4000);
 try{
  spin(5);
  const [leaves,thread]=await Promise.all([Promise.all(completed),workerClosed]);
  assert.equal(stopping,false);assert.equal(thread.pid,process.pid);assert.ok(thread.threadId>0);assert.equal(thread.exit,0);
  console.log(JSON.stringify({protocol,kind:'node-tree',role:'coordinator',pid:process.pid,ppid:process.ppid,pgid,children:leaves,allReaped:true,worker:thread}));
 }catch(error){
  stop();await Promise.allSettled([...completed,workerClosed]);
  process.stderr.write(String(error.message).slice(0,512)+'\n');process.exitCode=1;
 }finally{clearTimeout(timer);process.off('SIGTERM',stop);}
}
