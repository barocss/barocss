import {createHash} from 'node:crypto';
export const BINDINGS=Object.freeze([
 ['contactGeometry','contacts','reply',''],['positionCheck','world','reply',''],['ledgerCheck','step-ledger','reply',''],['quality','quality','reply',''],
 ['prepared.diagnostics.positionAttempt.problem','world','request','problem'],['prepared.diagnostics.positionAttempt.rowSources','world','request','rowSelections'],['prepared.diagnostics.positionAttempt.result','world','request','result'],['prepared.diagnostics.positionAttempt.preBodies','world','request','preBodies'],['prepared.diagnostics.positionAttempt.hypotheticalBodies','world','request','hypBodies'],
 ['prepared.diagnostics.beforeBodies','step-ledger','request','ledger.beforeBodies'],['prepared.diagnostics.freeBodies','step-ledger','request','ledger.freeBodies'],['prepared.diagnostics.velocityBodies','step-ledger','request','ledger.velocityBodies'],['prepared.candidateBodies','step-ledger','request','ledger.finalBodies'],['prepared.diagnostics.pointLedger','step-ledger','request','ledger.points'],['before.bodies','step-ledger','request','ledger.beforeBodies'],['after','quality','request','request.state']
].map(Object.freeze));
const WIRE=2**21,SCRATCH=16*2**20,FIXED=2**20,sha=b=>createHash('sha256').update(b).digest('hex');
export class Refusal extends Error{constructor(code){super(code);this.name='Refusal';this.code=code;}}
export function need(v,code){if(!v)throw new Refusal(code);}
const key=h=>h.scene+':'+h.step;
const eligible=h=>['ALIGNED','OFFSET','YAW'].includes(h.scene)&&h.step>=1;
export function positions(value,wanted=new Set()){
 const spans=new Map();let at=0,nodes=0,maxScalar=0;
 function walk(v,path,depth){need(depth<=64&&++nodes<=262144,'REF_GRAPH');const begin=at;
  if(v===null||typeof v!=='object'){need(v===null||['string','boolean','number'].includes(typeof v),'REF_VALUE');if(typeof v==='number')need(Number.isFinite(v),'REF_NONFINITE');const n=Buffer.byteLength(JSON.stringify(v));maxScalar=Math.max(maxScalar,n);at+=n;}
  else{const keys=Object.keys(v),array=Array.isArray(v);at++;for(let i=0;i<keys.length;i++){if(i)at++;const k=keys[i];if(!array)at+=Buffer.byteLength(JSON.stringify(k))+1;walk(v[k],path?path+'.'+k:k,depth+1);}at++;}
  need(at<=WIRE,'REF_JSON_BOUND');if(wanted.has(path))spans.set(path,{begin,end:at});
 }walk(value,'',0);return {bytes:at,spans,maxScalar};
}
function get(value,path){for(const k of path?path.split('.'):[]){need(value&&Object.hasOwn(value,k),'DICT_SOURCE_PATH');value=value[k];}return value;}
export class Views{
 constructor(){this.steps=new Map();this.unique=new Map();this.bytes=0;this.peakBytes=0;this.peakSteps=0;this.released=new Map();}
 add(h,raw,Q=0){
  if(h.channel!=='rpc'||!eligible(h))return;need(h.step>(this.released.get(h.scene)??0),'DICT_RELEASED');const ids=BINDINGS.map((b,i)=>[b,i]).filter(([b])=>b[1]===h.op&&b[2]===h.kind);if(!ids.length)return;
  need(Q+this.bytes+3*raw.length+FIXED<=SCRATCH,'REF_SCRATCH');const value=JSON.parse(raw.toString('utf8'));
  if(h.kind==='request'){need(value?.op===h.op,'DICT_REQUEST_OP');if(['world','step-ledger'].includes(h.op))need(value.scene===h.scene&&value.stepIndex===h.step,'DICT_REQUEST_ID');if(h.op==='quality')need(value.request?.state?.stepIndex===h.step,'DICT_REQUEST_ID');}
  const k=key(h);need(this.steps.has(k)||this.steps.size<3,'DICT_STEPS');let step=this.steps.get(k);if(!step){step=new Map();this.steps.set(k,step);}this.peakSteps=Math.max(this.peakSteps,this.steps.size);
  for(const [binding,id]of ids){need(!step.has(id),'DICT_DUPLICATE_SOURCE');const v=get(value,binding[3]),size=positions(v).bytes;
   need(Q+this.bytes+3*raw.length+3*size+FIXED<=SCRATCH,'REF_SCRATCH');const text=JSON.stringify(v),hash=createHash('sha256').update(text,'utf8').digest('hex');let u=this.unique.get(hash);if(!u)need(this.bytes+size<=WIRE,'DICT_CAP');const bytes=Buffer.from(text);need(bytes.length===size,'DICT_CANONICAL_SIZE');
   if(u)need(u.bytes.equals(bytes),'DICT_COLLISION');else{need(this.bytes+size<=WIRE,'DICT_CAP');u={bytes,uses:0};this.unique.set(hash,u);this.bytes+=size;this.peakBytes=Math.max(this.peakBytes,this.bytes);}u.uses++;step.set(id,{hash,sourceIndex:h.index,bytes:u.bytes});
  }
 }
 view(h,id){const entry=this.steps.get(key(h))?.get(id);need(entry,'DICT_MISSING');need(entry.sourceIndex<h.index,'REF_FORWARD');return entry;}
 release(h,committed=true){const k=key(h),step=this.steps.get(k);if(!step)return;for(const e of step.values()){const u=this.unique.get(e.hash);if(--u.uses===0){this.bytes-=u.bytes.length;this.unique.delete(e.hash);}}this.steps.delete(k);if(committed)this.released.set(h.scene,Math.max(this.released.get(h.scene)??0,h.step));}
 clear(){for(const k of [...this.steps.keys()]){const [scene,step]=k.split(':');this.release({scene,step:Number(step)},false);}}
 stats(){return {bytes:this.bytes,steps:this.steps.size,peakBytes:this.peakBytes,peakSteps:this.peakSteps,globalByteCap:WIRE,stepCap:3};}
}
export function encodeRecord(payload,h,cache,Q=0){
 if(!eligible(h))return null;need(payload.length>=16,'REF_RECORD_LENGTH');const J=payload.readUInt32BE(0),lengths=[0,4,8,12].map(i=>payload.readUInt32BE(i));need(16+lengths.reduce((a,b)=>a+b,0)===payload.length&&J<=WIRE,'REF_RECORD_LENGTH');
 need(Q+cache.bytes+2*payload.length+4*J+FIXED<=SCRATCH,'REF_SCRATCH');const json=payload.subarray(16,16+J),value=JSON.parse(json.toString('utf8')),info=positions(value,new Set(BINDINGS.map(b=>b[0]))),rows=[];
 need(info.bytes+1===J,'REF_CANONICAL_RECORD');for(let id=0;id<16;id++){const span=info.spans.get(BINDINGS[id][0]);need(span,'REF_TARGET_PATH');const v=cache.view(h,id);need(v.bytes.equals(json.subarray(span.begin,span.end)),'REF_TARGET_BYTES');rows.push({id,...span,view:v});}rows.sort((a,b)=>a.begin-b.begin);
 let end=0,covered=0;for(const r of rows){need(r.begin>=end,'REF_OVERLAP');covered+=r.end-r.begin;end=r.end;}const N=16+17*8+16*64+J-covered,S=20+N+payload.length-16-J;
 if(S>=payload.length)return null;
 need(Q+cache.bytes+2*payload.length+S+N+4*J+FIXED<=SCRATCH,'REF_SCRATCH');const program=Buffer.alloc(N);program.write('P227');program.writeUInt32BE(17,4);program.writeUInt32BE(16,8);program.writeUInt32BE(J,12);let p=16,cursor=0;
 for(let i=0;i<=rows.length;i++){const r=rows[i],stop=r?r.begin:J,n=stop-cursor;program.writeUInt32BE(n,p);program.writeUInt32BE(0,p+4);p+=8;json.copy(program,p,cursor,stop);p+=n;if(!r)break;
  program[p]=1;program[p+1]=r.id;program.writeUInt32BE(r.begin,p+4);program.writeUInt32BE(r.end-r.begin,p+8);program.writeUInt32BE(r.view.sourceIndex,p+12);Buffer.from(r.view.hash,'hex').copy(program,p+16);p+=64;cursor=r.end;
 }need(p===N,'REF_PROGRAM_SIZE');const stored=Buffer.alloc(S);for(let i=0;i<4;i++)stored.writeUInt32BE(lengths[i],i*4);stored.writeUInt32BE(N,16);program.copy(stored,20);payload.copy(stored,20+N,16+J);return stored;
}
export function decodeRecord(stored,h,P,cache){
 need(stored.length>=20,'REF_RECORD_LENGTH');const lengths=[0,4,8,12].map(i=>stored.readUInt32BE(i)),[J,W,B,R]=lengths,N=stored.readUInt32BE(16);need(J<=WIRE&&W<=512*1024&&B+R<=WIRE&&16+J+W+B+R===P&&20+N+W+B+R===stored.length,'REF_RECORD_LENGTH');
 need(cache.bytes+stored.length+P+4*J+FIXED<=SCRATCH,'REF_SCRATCH');const program=stored.subarray(20,20+N);need(N>=16&&program.subarray(0,4).toString()==='P227'&&program.readUInt32BE(4)===17&&program.readUInt32BE(8)===16&&program.readUInt32BE(12)===J,'REF_COUNT');
 const payload=Buffer.alloc(P);for(let i=0;i<4;i++)payload.writeUInt32BE(lengths[i],i*4);const json=payload.subarray(16,16+J),seen=new Set(),used=[];let p=16,cursor=0;
 for(let i=0;i<17;i++){need(p+8<=N&&program.readUInt32BE(p+4)===0,'REF_LITERAL');const n=program.readUInt32BE(p);p+=8;need(p+n<=N&&cursor+n<=J,'REF_LITERAL');program.copy(json,cursor,p,p+n);p+=n;cursor+=n;if(i===16)break;
  need(p+64<=N&&program[p]===1&&program.readUInt16BE(p+2)===0&&program.subarray(p+48,p+64).every(b=>b===0),'REF_DESCRIPTOR');const id=program[p+1],begin=program.readUInt32BE(p+4),size=program.readUInt32BE(p+8),sourceIndex=program.readUInt32BE(p+12),hash=program.subarray(p+16,p+48).toString('hex');
  need(id<16&&!seen.has(id),'REF_BINDING');seen.add(id);need(begin===cursor&&cursor+size<=J,'REF_OFFSET');need(sourceIndex<h.index,'REF_FORWARD');const v=cache.view(h,id);need(v.sourceIndex===sourceIndex,'DICT_SOURCE_ID');need(v.hash===hash&&sha(v.bytes)===hash,'DICT_HASH');need(v.bytes.length===size,'DICT_LENGTH');v.bytes.copy(json,cursor);cursor+=size;p+=64;used.push({id,begin,end:cursor});
 }need(p===N&&cursor===J,'REF_PROGRAM_SIZE');const info=positions(JSON.parse(json.toString('utf8')),new Set(BINDINGS.map(b=>b[0])));need(info.bytes+1===J,'REF_CANONICAL_RECORD');for(const r of used){const s=info.spans.get(BINDINGS[r.id][0]);need(s?.begin===r.begin&&s.end===r.end,'REF_TARGET_PATH');}stored.copy(payload,16+J,20+N);return payload;
}
