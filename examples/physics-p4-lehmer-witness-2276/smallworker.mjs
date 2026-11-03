// One owned sequential proof worker, no producer/model/answer imports.
import {certifyPositionWitness,encodeBounded,parseBoundedJSON,MAX_BYTES,RPC_PROTOCOL} from './candidate.mjs';

const deadline=performance.now()+170000;
let pending=Buffer.alloc(0),nextId=1,failed=false,activeBacking=0,writing=false;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function checkTime(){if(performance.now()>=deadline)throw new Error('WORKER_TIME_LIMIT');}
function send(value){checkTime();if(writing)throw new Error('WORKER_OUTSTANDING_REPLY');const allowance=Math.min(MAX_BYTES,Math.floor((4*1024*1024-activeBacking-65536)/3));if(allowance<1)throw new Error('WORKER_TRANSPORT_ALLOCATION_LIMIT');const text=encodeBounded(value,allowance);writing=true;process.stdin.pause();process.stdout.write(text,error=>{writing=false;if(error)fail(error);else if(!failed)process.stdin.resume();});}
function line(raw){
  checkTime();if(nextId>6)throw new Error('WORKER_REQUEST_LIMIT');if(raw.length===0||raw.length+1>MAX_BYTES)throw new Error('WORKER_LINE_LIMIT');
  activeBacking=raw.buffer.byteLength;if(activeBacking+2*raw.length+65536>4*1024*1024)throw new Error('WORKER_TRANSPORT_ALLOCATION_LIMIT');
  const request=parseBoundedJSON(raw,deadline);if(!plain(request)||Object.keys(request).length!==4||!['protocol','id','problem','result'].every(key=>Object.hasOwn(request,key))||request.protocol!==RPC_PROTOCOL||request.id!==nextId)throw new Error('WORKER_ENVELOPE');
  const {reply,modelExact}=certifyPositionWitness(request.problem,request.result,{deadline,includeModel:true});send({protocol:RPC_PROTOCOL,id:nextId,reply,modelExact});nextId++;activeBacking=0;
}
function fail(error){if(failed)return;failed=true;process.stderr.write(String(error?.stack??error)+'\n');process.exitCode=1;process.stdin.destroy();}
const watchdog=setTimeout(()=>fail(new Error('WORKER_TIME_LIMIT')),Math.max(1,Math.floor(deadline-performance.now())));
watchdog.unref();
process.stdin.on('data',chunk=>{
  if(failed)return;
  try{checkTime();if(chunk.length>65536||pending.length+chunk.length>MAX_BYTES+65536||pending.buffer.byteLength+pending.length+chunk.length+2*65536>4*1024*1024)throw new Error('WORKER_PENDING_LIMIT');pending=Buffer.concat([pending,chunk]);let index;
    while((index=pending.indexOf(10))!==-1){const raw=pending.subarray(0,index);pending=pending.subarray(index+1);line(raw);if(pending.length===0)pending=Buffer.alloc(0);if(writing){if(pending.length!==0)throw new Error('WORKER_PIPELINED_INPUT');break;}}
    if(pending.length>=MAX_BYTES)throw new Error('WORKER_LINE_LIMIT');
  }catch(error){fail(error);}
});
process.stdin.on('end',()=>{if(failed)return;try{checkTime();if(pending.length!==0)throw new Error('WORKER_PARTIAL_EOF');process.stdout.end();}catch(error){fail(error);}});
process.stdin.on('error',fail);process.stdout.on('error',fail);
send({protocol:RPC_PROTOCOL,type:'ready'});
