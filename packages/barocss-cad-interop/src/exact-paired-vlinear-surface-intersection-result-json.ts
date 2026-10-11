export const EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS = Object.freeze({ utf8Bytes:4194304, utf16Units:4194304, values:1048576, depth:64, recordFields:64, arrayElements:8192, stringUnits:262144, keyUnits:128 } as const);
export const BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode = Object.freeze({ INPUT:'INPUT', JSON:'JSON', OWNED:'OWNED', BUDGET:'BUDGET', SCHEMA:'SCHEMA', NATIVE:'NATIVE' } as const);
export type BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode = typeof BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode[keyof typeof BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode];
export interface ExactPairedVLinearSurfaceIntersectionJsonMetrics {
  pass:'strict-json-decode'; rawUtf8Bytes:number; rawUtf16Units:number; parsedValues:number;
  maxDepth:number; maxRecordFields:number; maxArrayElements:number; maxStringUnits:number;
  decodedKeys:number; numberTokens:number; negativeZeroNumbers:number;
}
export interface ExactPairedVLinearSurfaceIntersectionOwnCopyMetrics {
  pass:'descriptor-own-copy'; copiedOccurrences:number; maxDepth:number; maxRecordFields:number;
  maxArrayElements:number; maxStringUnits:number; propertyKeys:number; negativeZeroNumbers:number;
  aliasOccurrences:number; uniqueObjects:number; canonicalUtf8Bytes:number; canonicalUtf16Units:number;
}
export interface ExactPairedVLinearSurfaceIntersectionJsonDecoded { value:unknown; metrics:ExactPairedVLinearSurfaceIntersectionJsonMetrics }
export interface ExactPairedVLinearSurfaceIntersectionOwnDataCopy { value:unknown; metrics:ExactPairedVLinearSurfaceIntersectionOwnCopyMetrics }
export class BaroCadExactPairedVLinearSurfaceIntersectionReadError extends Error {
  readonly code:BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode;
  constructor(code:BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode,message:string,cause?:unknown){super(message.slice(0,1024),cause===undefined?undefined:{cause});this.name='BaroCadExactPairedVLinearSurfaceIntersectionReadError';this.code=code;}
}
function fail(code:BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode,message:string):never{throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(code,message)}
function check(condition:unknown,code:BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode,message:string):asserts condition{if(!condition)fail(code,message)}
/** Exact scalar UTF8 count; never encode-replace a lone UTF16 surrogate. */
export function scalarUtf8Bytes(text:string,code:BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode='JSON'):number{
 let bytes=0;for(let i=0;i<text.length;i++){const value=text.charCodeAt(i);if(value<128)bytes++;else if(value<2048)bytes+=2;else if(value>=0xd800&&value<=0xdbff){const next=text.charCodeAt(++i);check(next>=0xdc00&&next<=0xdfff,code,'Unpaired Unicode surrogate refused');bytes+=4}else{check(value<0xdc00||value>0xdfff,code,'Unpaired Unicode surrogate refused');bytes+=3}}return bytes;
}
export function parseExactPairedVLinearSurfaceIntersectionJson(text:string):ExactPairedVLinearSurfaceIntersectionJsonDecoded{
 check(typeof text==='string','INPUT','Exact paired V-linear Surface intersection JSON text must be a string');check(text.length<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.utf16Units,'BUDGET','Raw JSON UTF16 code-unit budget exceeded');
 const rawUtf8Bytes=scalarUtf8Bytes(text);check(rawUtf8Bytes<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.utf8Bytes,'BUDGET','Raw JSON UTF8 byte budget exceeded');
 const metrics:ExactPairedVLinearSurfaceIntersectionJsonMetrics={pass:'strict-json-decode',rawUtf8Bytes,rawUtf16Units:text.length,parsedValues:0,maxDepth:0,maxRecordFields:0,maxArrayElements:0,maxStringUnits:0,decodedKeys:0,numberTokens:0,negativeZeroNumbers:0};
 let position=0;
 const whitespace=()=>{while(position<text.length&&/[\t\n\r ]/.test(text[position]))position++};
 const string=():string=>{
  check(text[position++]==='"','JSON','JSON string required');let result='';
  while(position<text.length){const character=text[position++];if(character==='"'){scalarUtf8Bytes(result);metrics.maxStringUnits=Math.max(metrics.maxStringUnits,result.length);return result}check(character.charCodeAt(0)>=32,'JSON','Unescaped JSON control character refused');
   if(character!=='\\')result+=character;else{check(position<text.length,'JSON','Incomplete JSON escape');const escape=text[position++],escapes:Record<string,string>={'"':'"','\\':'\\','/':'/',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t'};if(escape==='u'){const hex=text.slice(position,position+4);check(/^[0-9a-fA-F]{4}$/.test(hex),'JSON','Malformed JSON Unicode escape');result+=String.fromCharCode(Number.parseInt(hex,16));position+=4}else{check(Object.hasOwn(escapes,escape),'JSON','Unknown JSON escape');result+=escapes[escape]}}
   check(result.length<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.stringUnits,'BUDGET','Decoded JSON string budget exceeded');
  }fail('JSON','Unterminated JSON string');
 };
 const numberPattern=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
 const value=(depth:number):unknown=>{
  check(++metrics.parsedValues<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.values&&depth<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.depth,'BUDGET','JSON value/depth budget exceeded');metrics.maxDepth=Math.max(metrics.maxDepth,depth);whitespace();const character=text[position];
  if(character==='"')return string();
  if(character==='{'){position++;whitespace();const entries:[string,unknown][]=[],keys=new Set<string>();if(text[position]==='}'){position++;return{}}for(;;){check(entries.length<EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.recordFields,'BUDGET','JSON record field budget exceeded');check(text[position]==='"','JSON','JSON object key required');const key=string();check(key.length<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.keyUnits,'BUDGET','JSON decoded key budget exceeded');check(!keys.has(key),'JSON','Duplicate decoded JSON key');keys.add(key);metrics.decodedKeys++;whitespace();check(text[position++]===':','JSON','JSON object colon required');entries.push([key,value(depth+1)]);metrics.maxRecordFields=Math.max(metrics.maxRecordFields,entries.length);whitespace();const separator=text[position++];if(separator==='}')return Object.fromEntries(entries);check(separator===',','JSON','JSON object comma or end required');whitespace();}}
  if(character==='['){position++;whitespace();const result:unknown[]=[];if(text[position]===']'){position++;return result}for(;;){check(result.length<EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.arrayElements,'BUDGET','JSON dense array budget exceeded');result.push(value(depth+1));metrics.maxArrayElements=Math.max(metrics.maxArrayElements,result.length);whitespace();const separator=text[position++];if(separator===']')return result;check(separator===',','JSON','JSON array comma or end required');}}
  for(const[token,result]of [['true',true],['false',false],['null',null]] as const)if(text.startsWith(token,position)){position+=token.length;return result}
  numberPattern.lastIndex=position;const match=numberPattern.exec(text);check(match!==null,'JSON','JSON value required');position=numberPattern.lastIndex;const number=Number(match[0]);check(Number.isFinite(number),'JSON','Nonfinite JSON number refused');metrics.numberTokens++;if(Object.is(number,-0))metrics.negativeZeroNumbers++;return number;
 };
 const parsed=value(0);whitespace();check(position===text.length,'JSON','Trailing JSON data refused');return{value:parsed,metrics};
}
/** Descriptor-value per-occurrence copy. Mutable aliases are never retained. */
export function copyExactPairedVLinearSurfaceIntersectionOwnData(input:unknown):ExactPairedVLinearSurfaceIntersectionOwnDataCopy{
 const metrics:ExactPairedVLinearSurfaceIntersectionOwnCopyMetrics={pass:'descriptor-own-copy',copiedOccurrences:0,maxDepth:0,maxRecordFields:0,maxArrayElements:0,maxStringUnits:0,propertyKeys:0,negativeZeroNumbers:0,aliasOccurrences:0,uniqueObjects:0,canonicalUtf8Bytes:1,canonicalUtf16Units:1};
 const ancestors=new Set<object>(),seen=new WeakSet<object>();
 function cost(bytes:number,units:number):void{metrics.canonicalUtf8Bytes+=bytes;metrics.canonicalUtf16Units+=units;check(metrics.canonicalUtf8Bytes<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.utf8Bytes&&metrics.canonicalUtf16Units<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.utf16Units,'BUDGET','Owned canonical JSON plus newline budget exceeded');}
 function quoted(text:string,key=false):void{check(text.length<=(key?EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.keyUnits:EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.stringUnits),'BUDGET',key?'Owned key budget exceeded':'Owned string budget exceeded');scalarUtf8Bytes(text,'OWNED');const encoded=JSON.stringify(text);cost(scalarUtf8Bytes(encoded,'OWNED'),encoded.length);if(!key)metrics.maxStringUnits=Math.max(metrics.maxStringUnits,text.length);}
 const copy=(value:unknown,depth:number):unknown=>{
  check(++metrics.copiedOccurrences<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.values&&depth<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.depth,'BUDGET','Owned occurrence/depth budget exceeded');metrics.maxDepth=Math.max(metrics.maxDepth,depth);
  if(value===null){cost(4,4);return value}if(typeof value==='boolean'){const size=value?4:5;cost(size,size);return value}
  if(typeof value==='number'){check(Number.isFinite(value),'OWNED','Finite own numbers required');const token=Object.is(value,-0)?'-0':String(value);if(Object.is(value,-0))metrics.negativeZeroNumbers++;cost(token.length,token.length);return value}
  if(typeof value==='string'){quoted(value);return value}
  check(value!==null&&typeof value==='object','OWNED','Plain supported own data required');check(!ancestors.has(value),'OWNED','Own ancestor cycle refused');
  const array=Array.isArray(value),keys=Reflect.ownKeys(value);check(keys.length<=(array?EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.arrayElements+1:EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.recordFields),'BUDGET','Owned key-count budget exceeded before descriptors');
  const prototype=Object.getPrototypeOf(value);check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'OWNED','Foreign own-data prototype refused');
  check(keys.every(key=>typeof key==='string'),'OWNED','Symbolic own keys refused');
  const stringKeys=keys as string[];
  for(const key of stringKeys){check(key.length<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.keyUnits,'BUDGET','Owned key budget exceeded');scalarUtf8Bytes(key,'OWNED');}
  const descriptors=Object.getOwnPropertyDescriptors(value);
  check(stringKeys.every(key=>'value'in descriptors[key]&&(array&&key==='length'||descriptors[key].enumerable===true)),'OWNED','Getter or hidden own data refused');
  if(seen.has(value))metrics.aliasOccurrences++;else{seen.add(value);metrics.uniqueObjects++}ancestors.add(value);
  try{
   cost(2,2);
   if(array){const length:unknown=descriptors.length?.value;check(typeof length==='number'&&Number.isInteger(length)&&length>=0&&length<=EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS.arrayElements,'BUDGET','Owned dense array length budget exceeded');check(keys.length===length+1,'OWNED','Sparse or extra-field own array refused');metrics.maxArrayElements=Math.max(metrics.maxArrayElements,length);const result:unknown[]=[];for(let index=0;index<length;index++){const descriptor=descriptors[String(index)];check(descriptor?.enumerable&&'value'in descriptor,'OWNED','Dense own array data required');if(index)cost(1,1);result.push(copy(descriptor.value,depth+1))}return result;}
   metrics.maxRecordFields=Math.max(metrics.maxRecordFields,keys.length);const entries:[string,unknown][]=[];for(const[index,key]of stringKeys.entries()){if(index)cost(1,1);quoted(key,true);cost(1,1);metrics.propertyKeys++;entries.push([key,copy(descriptors[key].value,depth+1)])}return Object.fromEntries(entries);
  }finally{ancestors.delete(value)}
 };
 try{return{value:copy(input,0),metrics}}catch(cause){if(cause instanceof BaroCadExactPairedVLinearSurfaceIntersectionReadError)throw cause;throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError('OWNED','Own descriptor snapshot refused',cause)}
}
