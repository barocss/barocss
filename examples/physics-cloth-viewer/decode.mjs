import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {clothMetrics} from './metrics.mjs';
const folder=resolve(process.argv[2]),r=JSON.parse(gunzipSync(readFileSync(resolve(folder,'report.json.gz'))));
let bytes=0;for(let i=0;i<241;i++){const original=r.first[i],state={...original,positionsM:new Float64Array(867),velocitiesMps:new Float64Array(867),triangles:Uint16Array.from(original.triangles),pinnedVertexIndices:Uint16Array.from(original.pinnedVertexIndices)};for(const key of ['positionsM','velocitiesMps']){const rec=r.rawRecords[i].arrays[key],raw=gunzipSync(readFileSync(resolve(folder,rec.file)));assert.equal(createHash('sha256').update(raw).digest('hex'),rec.sha256);assert.equal(raw.length,rec.bytes);const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),negative=[];for(let j=0;j<867;j++){const value=view.getFloat64(j*8,true);state[key][j]=value;assert.ok(value===original[key][j]);if(Object.is(value,-0))negative.push(j);}assert.deepEqual(negative,rec.negativeZeroOffsets);assert.equal(raw.toString('hex'),original[key==='positionsM'?'positionsHex':'velocitiesHex']);bytes+=raw.length;}assert.deepEqual(clothMetrics(state),Object.fromEntries(Object.entries(r.metrics[i]).filter(([k])=>k!=='stepIndex')));}
assert.equal(r.passed,true);assert.equal(r.exactRepeat,true);console.log(JSON.stringify({acceptedStates:241,rawBytes:bytes,rawHashAndSigns:true,allNumericMetricsReplayed:true,importsNoSolver:true,head:r.gitHead}));
