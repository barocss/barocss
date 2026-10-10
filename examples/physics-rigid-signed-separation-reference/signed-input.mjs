export const MESSAGES={input:'signed position reference input is invalid',limit:'signed position reference admits at most nine bodies and eight rows',empty:'signed position reference requires at least one body',ids:'signed position reference body IDs must be nonempty and unique',mass:'signed position reference inverse mass is invalid',endpoints:'signed position reference row endpoints are invalid',normal:'signed position reference normal must be finite and unit length',bound:'signed position reference bound must be finite and between minus ten and ten metres',result:'signed position reference result is invalid'};
export class SignedPositionReferenceError extends Error{constructor(code,message){super(message);this.name='SignedPositionReferenceError';this.code=code;}}
export function requireSigned(condition,key='input',code='INVALID_INPUT'){if(!condition)throw new SignedPositionReferenceError(code,MESSAGES[key]);}
export function plain(value,keys){return value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)&&Reflect.ownKeys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
export function dense(value,size){return Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&(size===undefined||value.length===size)&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>i).every(i=>{const d=Object.getOwnPropertyDescriptor(value,i);return d!==undefined&&'value' in d;});}
export const finiteVector=(v,size)=>dense(v,size)&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
export function validateSignedProblem(problem){
 requireSigned(plain(problem,['bodies','rows'])&&dense(problem.bodies)&&dense(problem.rows));
 if(problem.bodies.length>9||problem.rows.length>8)requireSigned(false,'limit','PROFILE_LIMIT');
 requireSigned(problem.bodies.length>0,'empty');
 const ids=new Set();
 for(const b of problem.bodies){requireSigned(plain(b,['id','inverseMass']));requireSigned(typeof b.id==='string'&&b.id.length>0&&!ids.has(b.id),'ids');ids.add(b.id);requireSigned(typeof b.inverseMass==='number'&&Number.isFinite(b.inverseMass)&&(b.inverseMass===0||b.inverseMass>=1e-6&&b.inverseMass<=1e6),'mass');}
 for(const row of problem.rows){requireSigned(plain(row,['aId','bId','normal','boundM']));requireSigned(ids.has(row.aId)&&ids.has(row.bId)&&row.aId!==row.bId,'endpoints');requireSigned(finiteVector(row.normal,3)&&Math.abs(Math.hypot(...row.normal)-1)<=1e-12,'normal');requireSigned(typeof row.boundM==='number'&&Number.isFinite(row.boundM)&&row.boundM>=-10&&row.boundM<=10,'bound');}
}
