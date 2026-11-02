/** DATA-only full authentication before any current World call. No numerical provider imports. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function authenticateClothOracle(summaryPath,summarySha){
  const directory=dirname(resolve(summaryPath)),summaryBytes=await readFile(summaryPath);assert.equal(sha(summaryBytes),summarySha);const summary=JSON.parse(summaryBytes);assert.equal(summary.status,'PASS_ORIGINAL_CLOTH_RESEARCH_ORACLE');
  const artifacts={};let total=0;
  for(const [name,pin]of Object.entries(summary.artifacts)){assert(['oracle-f64le.bin','oracle-triangles-u16le.bin','oracle-index.json','provider-graph.json'].includes(name));const b=await readFile(resolve(directory,name));assert.equal(b.length,pin.bytes,name);assert.equal(sha(b),pin.sha256,name);artifacts[name]=b;total+=b.length;}
  assert(total<=4194304);const raw=artifacts['oracle-f64le.bin'],index=JSON.parse(artifacts['oracle-index.json']);assert.equal(raw.length,3343152);assert.equal(index.frames.length,241);assert.equal(index.valuesPerArray,867);assert.equal(index.byteOrder,'LE');
  for(let step=0;step<=240;step++){const row=index.frames[step];assert.equal(row.step,step);assert.equal(row.offset,step*13872);assert.equal(row.bytes,13872);const frame=raw.subarray(row.offset,row.offset+row.bytes);assert.equal(sha(frame),row.sha256);assert.equal(sha(frame.subarray(0,6936)),row.positionsSha256);assert.equal(sha(frame.subarray(6936)),row.velocitiesSha256);for(let i=0;i<1734;i++)assert(Number.isFinite(frame.readDoubleLE(i*8)));}
  assert.equal(artifacts['oracle-triangles-u16le.bin'].length,3072);
  return {authenticatedRows:241,rawBytes:raw.length,summarySha256:summarySha,getFrame(step){assert(Number.isInteger(step)&&step>=0&&step<=240);const positionsM=new Float64Array(867),velocitiesMps=new Float64Array(867);for(let i=0;i<867;i++){positionsM[i]=raw.readDoubleLE(step*13872+i*8);velocitiesMps[i]=raw.readDoubleLE(step*13872+6936+i*8);}return {stepIndex:step,positionsM,velocitiesMps};},getTriangles(){const output=new Uint16Array(1536);for(let i=0;i<1536;i++)output[i]=artifacts['oracle-triangles-u16le.bin'].readUInt16LE(i*2);return output;}};
}
