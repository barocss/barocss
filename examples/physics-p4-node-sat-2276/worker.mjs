import {Meter,prepare,evaluatePair,explicitSize} from './integer-sat.mjs';

const MAX_LINE=256*1024, MAX_DATA=12*1024*1024, SCRATCH=2*1024*1024;
const meter=new Meter();
let states=null, buffer=Buffer.alloc(0), expected=1, frames=0, pairs=0, failed=false;
const cpu=()=>{const r=process.cpuUsage();return {userUs:r.user,systemUs:r.system,totalUs:r.user+r.system};};
function send(value,done) {
  if(explicitSize(value)>MAX_LINE*3) throw new Error('REPLY_PREALLOCATION_LIMIT');
  const text=JSON.stringify(value)+'\n';
  if(Buffer.byteLength(text)>MAX_LINE) throw new Error('REPLY_LINE_LIMIT');
  process.stdout.write(text,done);
}
function handle(request) {
  if(request.id!==expected++) throw new Error('REQUEST_SEQUENCE');
  if(request.op==='begin') {
    if(++frames>6) throw new Error('FRAME_LIMIT');
    const result={};
    for(const stage of ['PRE','HYP']) {
      const bodies=request[stage];
      if(!Array.isArray(bodies)||bodies.length!==9) throw new Error('NINE_BODY_LAYOUT');
      const items=bodies.map(body=>prepare(body,meter));
      if(new Set(items.map(v=>v.id)).size!==9) throw new Error('UNIQUE_BODY_IDS');
      result[stage]=new Map(items.map(v=>[v.id,v]));
    }
    // Map entries are explicitly included; do not treat a Map as an empty object.
    if(explicitSize([...result.PRE.values(),...result.HYP.values()])+SCRATCH+2*MAX_LINE>MAX_DATA) throw new Error('WORKER_EXPLICIT_DATA_LIMIT');
    states=result;
    return {preparedBodies:18};
  }
  if(request.op==='pair') {
    if(!states||!states[request.stage]||++pairs>432) throw new Error('PAIR_LIMIT_OR_STAGE');
    const a=states[request.stage].get(request.aId), b=states[request.stage].get(request.bId);
    if(!a||!b||a.id>=b.id) throw new Error('DIRECTED_BODY_IDS');
    return evaluatePair(a,b,request.stage,meter);
  }
  if(request.op==='barrier') return {frames,pairs};
  if(request.op==='quit') return {quit:true,frames,pairs};
  throw new Error('UNKNOWN_OPERATION');
}
process.stdin.on('data',chunk=>{
  if(failed) return;
  if(buffer.length+chunk.length>MAX_LINE) { failed=true; process.stderr.write('INPUT_LINE_LIMIT\n'); process.exitCode=1; process.stdin.destroy(); process.stdout.end(); return; }
  buffer=Buffer.concat([buffer,chunk]);
  let index;
  while((index=buffer.indexOf(10))>=0) {
    const line=buffer.subarray(0,index); buffer=buffer.subarray(index+1);
    let request;
    const started=process.cpuUsage();
    try {
      request=JSON.parse(line.toString('utf8'));
      const result=handle(request), used=process.cpuUsage(started);
      const reply={id:request.id,ok:true,result,stats:meter.stats(),requestCpu:{userUs:used.user,systemUs:used.system},cumulativeCpu:cpu(),pid:process.pid};
      if(request.op==='quit') {
        failed=true; process.stdin.pause(); send(reply,()=>process.stdout.end(()=>process.exit(0)));
      } else send(reply);
    } catch(error) {
      failed=true; process.stdin.pause();
      send({id:request?.id??null,ok:false,error:{type:error.name,message:error.message},stats:meter.stats(),cumulativeCpu:cpu(),pid:process.pid},()=>process.stdout.end(()=>process.exit(1)));
    }
  }
});
process.stdin.on('end',()=>{if(!failed){if(buffer.length){process.stderr.write('INCOMPLETE_INPUT_LINE\n');process.exitCode=1;}process.stdout.end();}});
send({id:0,ok:true,ready:true,pid:process.pid,node:process.version,stats:meter.stats(),cumulativeCpu:cpu()});
