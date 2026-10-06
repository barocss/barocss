import { preparePrimitive } from './primitives.mjs';
export const projectByteLimit=300*1024;
const encoder=new TextEncoder();
// The complete file is a small bounded data tree, never an executable object.
function copyData(value,seen=new Set(),depth=0,budget={count:0}){
 if(++budget.count>128||depth>6)throw new RangeError('Project data exceeds structural limits');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw new RangeError('Project numbers must be finite');return value;}
 if(typeof value==='string'){if(encoder.encode(value).length>256*1024)throw new RangeError('Project source exceeds 256 KiB');return value;}
 if(!value||typeof value!=='object'||seen.has(value))throw new TypeError('Project requires unaliased plain data');
 seen.add(value);
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
 if(proto!==(array?Array.prototype:Object.prototype))throw new TypeError('Project requires plain objects and arrays');
 const keys=Reflect.ownKeys(value);
 if(keys.length>16)throw new RangeError('Project record has too many fields');
 const out=array?[]:{};
 if(array&&(value.length>3||keys.length!==value.length+1))throw new TypeError('Project arrays must be dense triples');
 for(const key of keys){
  if(array&&key==='length')continue;
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!d||!('value' in d)||!d.enumerable||(array&&!/^[0-2]$/.test(key)))throw new TypeError('Project fields must be safe own data');
  out[key]=copyData(d.value,seen,depth+1,budget);
 }
 return out;
}
function exact(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))throw new TypeError(`${label} has missing or foreign fields`);}
export function validateProject(record,gpu){
 const value=copyData(record);
 exact(value,['format','version','sourceVersion','source','surfaceId','grid','options','primitive'],'Project');
 if(value.format!=='barocss-cad-project'||value.version!==1)throw new RangeError('Unsupported project format or version');
 if(value.sourceVersion!==0&&value.sourceVersion!==1)throw new RangeError('Project sourceVersion must be 0 or 1');
 if(typeof value.source!=='string'||!value.source.trim())throw new TypeError('Project requires source text');
 if(typeof value.surfaceId!=='string'||value.surfaceId.length>128||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value.surfaceId))throw new TypeError('Project requires a supported surface ID');
 exact(value.grid,['countU','countV'],'Project grid');
 for(const count of Object.values(value.grid))if(!Number.isInteger(count)||count<2||count>64)throw new RangeError('Project grid counts must be integers in 2..64');
 value.options=structuredClone(gpu.validateMeshOptions(value.options));
 if(value.primitive!==null){
  exact(value.primitive,['kind','size','height'],'Project primitive');
  const generated=preparePrimitive(value.primitive);
  if(value.sourceVersion!==1||value.surfaceId!==generated.surfaceId||generated.inputId!=='profile'||value.source!==generated.source)throw new RangeError('Project primitive provenance does not match canonical source');
 }
 return value;
}
export function parseProject(text,gpu){
 if(typeof text!=='string'||!text.trim())throw new TypeError('Project file is empty');
 if(encoder.encode(text).length>projectByteLimit)throw new RangeError('Project file exceeds 300 KiB');
 return validateProject(JSON.parse(text),gpu);
}
export function serializeProject(record,gpu){
 const value=validateProject(record,gpu);
 // Number.toString round-trips binary64; JSON.stringify would discard negative zero.
 const emit=v=>v===null?'null':typeof v==='number'?(Object.is(v,-0)?'-0':String(v)):typeof v==='string'?JSON.stringify(v):typeof v==='boolean'?String(v):Array.isArray(v)?'['+v.map(emit).join(',')+']':'{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+emit(x)).join(',')+'}';
 const text=emit(value)+'\n';
 if(encoder.encode(text).length>projectByteLimit)throw new RangeError('Project file exceeds 300 KiB');
 return text;
}
