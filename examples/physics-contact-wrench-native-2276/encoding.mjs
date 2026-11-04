// Lossless JSON DAG encoding only. No numerical/producer/observer imports.
import {createHash} from 'node:crypto';
const hash=text=>createHash('sha256').update(text).digest('hex');
const object=x=>x!==null&&typeof x==='object';
export function canonicalJson(x){return Array.isArray(x)?'['+x.map(canonicalJson).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(x[k])).join(',')+'}':JSON.stringify(x);}
export function encodeTracePacket(raw){
 const frequencies=new Map(),metadata=new WeakMap();
 function inspect(x){if(x===undefined)throw Error('Undefined canonical trace field');if(!object(x))return;if(!Array.isArray(x)&&Object.keys(x).length===1&&Object.hasOwn(x,'$node'))throw Error('Reserved trace encoding key');for(const v of Array.isArray(x)?x:Object.values(x))inspect(v);const text=canonicalJson(x),key=hash(text);metadata.set(x,{key,bytes:Buffer.byteLength(text)});const prior=frequencies.get(key);if(prior)prior.count++;else frequencies.set(key,{count:1,bytes:Buffer.byteLength(text)});}
 inspect(raw);const objects={};
 function children(x){return Array.isArray(x)?x.map(encode):object(x)?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,encode(v)])):x;}
 function encode(x){if(!object(x))return x;const m=metadata.get(x),f=frequencies.get(m.key);if(f.count>1&&f.bytes>=256){if(!Object.hasOwn(objects,m.key))objects[m.key]=children(x);return{$node:m.key};}return children(x);}
 const root=encode(raw);return{format:'physics-lossless-trace-dag-v1',expandedCanonicalSha256:metadata.get(raw).key,expandedCanonicalBytes:Buffer.byteLength(canonicalJson(raw)),root,objects,semantics:'All raw binary64 words/events/poses/cache/query data retained; references replace repeated immutable JSON subtrees only'};
}
