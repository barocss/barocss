// Fixed captured-byte inspection only. No codec, physics or numerical oracle.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';

const [output]=process.argv.slice(2);assert.equal(process.argv.length,3);
const root=process.cwd(),base=join(root,'examples/physics-stack-evidence-refs-2276');
const input=JSON.parse(readFileSync(join(base,'evidence/raw-strings-01/measurement.json')));
assert.equal(input.status,'FIXED_ALIGNED2_RAW_QUOTED_LEXEME_COUNTS');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources=new Map();let total=0;
for(const item of input.inputs){
 const stored=readFileSync(resolve(root,item.path));assert.equal(hash(stored),item.sha256);
 const bytes=item.compressed?gunzipSync(stored,{maxOutputLength:2**21}):stored;
 assert.equal(hash(bytes),item.decodedSha256);total+=bytes.length;assert.ok(total<=2**21);
 sources.set(item.name,bytes);
}
const rows=[];let eligible=0,rawBytes=0,magnitudeBytes=0,zeroBytes=0,occurrences=0,weightedRaw=0,weightedMagnitude=0;
for(const row of input.rows){
 const bytes=sources.get(row.source.input).subarray(row.source.begin,row.source.end);
 assert.equal(hash(bytes),row.sha256);
 if(bytes.length>8195)continue;
 const text=bytes.toString('ascii');
 if(!/^"-?[1-9][0-9]*"$/.test(text))continue;
 const value=BigInt(text.slice(1,-1)),absolute=value<0n?-value:value;
 let hex=absolute.toString(16);if(hex.length%2)hex='0'+hex;
 const binary=Buffer.from(hex,'hex');
 assert.deepEqual(Buffer.from('"'+value.toString(10)+'"'),bytes);
 let zeros=0;for(const byte of binary)if(byte===0)zeros++;
 const count=row.occurrences.length;
 eligible++;rawBytes+=bytes.length;magnitudeBytes+=binary.length;zeroBytes+=zeros;
 occurrences+=count;weightedRaw+=count*bytes.length;weightedMagnitude+=count*binary.length;
 rows.push({id:row.id,quotedBytes:bytes.length,magnitudeBytes:binary.length,zeroBytes:zeros,occurrences:count,rawSHA256:row.sha256});
}
const result={status:'PASS_FIXED_INTEGER_TEXT_BINARY_ROUNDTRIP_MEASUREMENT',
 sourceInputBytes:total,uniqueCanonicalIntegerLexemes:eligible,uniqueQuotedBytes:rawBytes,
 uniqueMagnitudeBytes:magnitudeBytes,zeroMagnitudeBytes:zeroBytes,occurrences,
 weightedOriginalQuotedBytes:weightedRaw,weightedMagnitudeBytes:weightedMagnitude,
 hypotheticalEntryOverheadBytes:5,
 hypotheticalRawSavingsExcludingFraming:weightedRaw-weightedMagnitude-5*occurrences,
 rows,compressionCalls:0,physicsCalls:0,implementedCodec:false,
 compressedFitForecast:'NOT_CLAIMED',API:false};
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(bytes.length<=2**21);
mkdirSync(output);writeFileSync(join(output,'measurement.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({...result,rows:undefined}));
