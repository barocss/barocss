// Fixed lexeme-byte round trips only. No physical arithmetic or compressor.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
const [out]=process.argv.slice(2);assert.equal(process.argv.length,3);
const root=process.cwd(),home=join(root,'examples/physics-stack-evidence-refs-2276');
const input=JSON.parse(readFileSync(join(home,'evidence/raw-strings-01/measurement.json')));
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=new Map();let total=0;
for(const item of input.inputs){const stored=readFileSync(resolve(root,item.path));assert.equal(hash(stored),item.sha256);const bytes=item.compressed?gunzipSync(stored,{maxOutputLength:2**21}):stored;assert.equal(hash(bytes),item.decodedSha256);total+=bytes.length;assert.ok(total<=2**21);sources.set(item.name,bytes);}
const binary=n=>{let text=(n<0n?-n:n).toString(16);if(text.length%2)text='0'+text;return Buffer.from(text,'hex');};
const kinds={},rows=[];
for(const row of input.rows){
 const bytes=sources.get(row.source.input).subarray(row.source.begin,row.source.end);assert.equal(hash(bytes),row.sha256);
 const text=bytes.toString('ascii'),fraction=/^"(-?[1-9][0-9]*)\/([1-9][0-9]*)"$/.exec(text);
 let kind='literal',encoded=bytes.length,zeros=0;
 if(fraction&&text.length<=16390){
  const n=BigInt(fraction[1]),d=BigInt(fraction[2]);assert.deepEqual(Buffer.from('"'+n.toString(10)+'/'+d.toString(10)+'"'),bytes);
  const a=binary(n),b=binary(d);encoded=7+a.length+b.length;for(const x of [a,b])for(const byte of x)if(byte===0)zeros++;kind='canonical-fraction';
 }else if(/^"[0-9a-f]+"$/.test(text)&&text.length%2===0){
  const decoded=Buffer.from(text.slice(1,-1),'hex');assert.deepEqual(Buffer.from('"'+decoded.toString('hex')+'"'),bytes);encoded=5+decoded.length;for(const byte of decoded)if(byte===0)zeros++;kind='lowercase-even-hex';
 }
 const count=row.occurrences.length,k=kinds[kind]??={unique:0,rawUniqueBytes:0,encodedUniqueBytes:0,zeroBinaryBytes:0,occurrences:0,weightedRawBytes:0,weightedEncodedBytes:0};
 k.unique++;k.rawUniqueBytes+=bytes.length;k.encodedUniqueBytes+=encoded;k.zeroBinaryBytes+=zeros;k.occurrences+=count;k.weightedRawBytes+=count*bytes.length;k.weightedEncodedBytes+=count*encoded;
 rows.push({id:row.id,kind,rawBytes:bytes.length,hypotheticalEncodedBytes:encoded,zeroBinaryBytes:zeros,rawSHA256:row.sha256});
}
const result={status:'PASS_FIXED_FRACTION_HEX_BYTE_ROUNDTRIP_MEASUREMENT',sourceBytes:total,kinds,rows,
 compressionCalls:0,physicsCalls:0,implementedCodec:false,compressedFitForecast:'NOT_CLAIMED',API:false};
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(bytes.length<=2**21);mkdirSync(out);writeFileSync(join(out,'measurement.json'),bytes,{flag:'wx'});console.log(JSON.stringify({...result,rows:undefined}));
