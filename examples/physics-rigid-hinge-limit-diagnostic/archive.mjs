import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
export const PARENT_NATIVE='0de27c51574e2da6b09966c7ef0c28435d9c9592';
export const PARENT_SOURCE='82c24a21e63e7e246c91e013f5be38f763c373ee';
export const MANIFEST_SHA='45175603c18bd1417f2bcd58a6af49b201c4c2da02dc8b9cedf19e0ab9bf9e2f';
export const SOURCE_FREEZE_SHA='cbcc8649e9b73fe28a80d0ed794b2cad69d772f2b7bac0aab6a23b8cda803a66';
export const PARENT_DIRECTORY='examples/physics-rigid-multi-hinge-reference';
export const GRAPHS=['source','source-repeat','compiled-dependencies'];
export const BODY_IDS=['pairA0','pairB0','pairA1','pairB1'];
export const digest=data=>createHash('sha256').update(data).digest('hex');
export class ArchiveError extends Error {constructor(message){super(message);this.name='ArchiveError';this.code='ARCHIVE_INVALID';}}
export function requireArchive(value,message){if(!value)throw new ArchiveError(message);}
function parse(bytes,label){try{return JSON.parse(bytes);}catch(error){if(error instanceof SyntaxError)throw new ArchiveError(`${label} invalid JSON`);throw error;}}
export function validateFiles(files){
 const bytes=files.get('manifest.json');requireArchive(Buffer.isBuffer(bytes)&&digest(bytes)===MANIFEST_SHA,'archive manifest hash mismatch');
 const manifest=parse(bytes,'manifest');requireArchive(Object.keys(manifest).length===26,'archive manifest count mismatch');
 requireArchive(JSON.stringify([...files.keys()].sort())===JSON.stringify([...Object.keys(manifest),'manifest.json'].sort()),'archive file set mismatch');
 for(const [name,hash]of Object.entries(manifest)){requireArchive(/^[A-Za-z0-9.-]+$/.test(name),'archive filename invalid');requireArchive(Buffer.isBuffer(files.get(name))&&digest(files.get(name))===hash,'archive artifact hash mismatch');}
 return manifest;
}
export function restoreFrame(state,bytes,ids,step){
 requireArchive(Buffer.isBuffer(bytes)&&bytes.length===ids.length*104,'raw frame length mismatch');
 requireArchive(state!==null&&typeof state==='object'&&!Array.isArray(state),'archive state object required');
 requireArchive(state.stepIndex===step&&state.timeSeconds===step*(1/120),'archive cursor mismatch');
 requireArchive(Array.isArray(state.bodies)&&state.bodies.length===ids.length&&state.bodies.every((b,i)=>b&&b.id===ids[i]),'archive body IDs mismatch');
 const copy=structuredClone(state);let offset=0;
 for(const body of copy.bodies){requireArchive(body.kind==='dynamic'&&body.shape?.kind==='sphere'&&body.shape.radiusM===.1&&body.inertiaKgM2===0.4*.1**2,'archive body profile mismatch');
  for(const [field,size,bound]of [['positionM',3,10000],['velocityMps',3,1000],['orientation',4,1],['angularVelocityRadps',3,1000]]){
   requireArchive(Array.isArray(body[field])&&body[field].length===size,'archive raw field shape mismatch');
   for(let i=0;i<size;i++){const value=bytes.readDoubleLE(offset);offset+=8;requireArchive(Number.isFinite(value)&&Math.abs(value)<=bound,'archive raw field nonfinite or out of bounds');requireArchive(value===body[field][i],'archive JSON/raw field mismatch');body[field][i]=value;}
  }
  requireArchive(Math.abs(Math.hypot(...body.orientation)-1)<=1e-9,'archive quaternion norm mismatch');
 }
 return copy;
}
export function rawBodies(bodies){const bytes=Buffer.alloc(bodies.length*104);let offset=0;for(const b of bodies)for(const v of [...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps]){requireArchive(Number.isFinite(v),'raw output nonfinite');bytes.writeDoubleLE(v,offset);offset+=8;}requireArchive(offset===bytes.length,'raw output field shape mismatch');return bytes;}
export function decodeArchive(files){
 validateFiles(files);const provenance=parse(files.get('provenance.json'),'provenance');
 requireArchive(provenance.measuredHead===PARENT_SOURCE&&provenance.base==='6bd3376d6943a8d84b83ca62b0031a9ec8927bea'&&provenance.sourceFreezeSha256===SOURCE_FREEZE_SHA&&provenance.affectedBuildExit===0&&provenance.strictTypesExit===0&&provenance.consumerExit===0&&provenance.sourceRepeatCompiledEqual===true&&provenance.numericalGO===false&&provenance.actualCompletedStepsPerGraph===197&&provenance.acceptedSnapshotsPerGraph===198,'archive provenance mismatch');
 for(const [name,hash]of Object.entries(provenance.uncompressedArtifactHashes)){const file=files.get(name)??files.get(name+'.gz');requireArchive(Buffer.isBuffer(file),'archive uncompressed artifact missing');const bytes=files.has(name)?file:gunzipSync(file);requireArchive(digest(bytes)===hash,'archive uncompressed artifact hash mismatch');}
 const rows=[];
 for(const graph of GRAPHS){
  const report=parse(gunzipSync(files.get(`${graph}-report.json.gz`)),`${graph} report`),raw=gunzipSync(files.get(`${graph}-fields.f64le.gz`));
  requireArchive(report.graph===graph&&report.acceptedSnapshots===198&&report.completedSteps===197&&report.numericalGO===false&&report.failure?.kind==='independent-quality'&&report.failure.step===197,'archive report identity mismatch');
  requireArchive(report.rawLayout?.format==='Float64LE'&&report.rawLayout.bytesPerPrivateFrame===416&&report.rawLayout.bytesPerPublicPairFrame===208&&JSON.stringify(report.rawLayout.bodyOrder)===JSON.stringify(BODY_IDS)&&JSON.stringify(report.rawLayout.fields)===JSON.stringify(['positionM3','velocityMps3','orientation4','angularVelocityRadps3']),'archive raw layout mismatch');
  requireArchive(report.snapshots.length===198&&raw.length===198*416&&report.rawBytes===raw.length&&digest(raw)===report.rawSha256&&digest(raw)===provenance.rawFieldHashes[graph],'archive raw length/hash mismatch');
  const states=report.snapshots.map((s,i)=>restoreFrame(s,raw.subarray(i*416,(i+1)*416),BODY_IDS,i));
  requireArchive(report.publicCanonicalSinglePairSnapshots.length===2&&report.publicRawHashes.length===2&&report.measurements.length===198,'archive public/counter length mismatch');
  const publicStates=[],publicRaw=[];
  for(const group of [0,1]){const bytes=gunzipSync(files.get(`${graph}-public-pair${group}.f64le.gz`)),snapshots=report.publicCanonicalSinglePairSnapshots[group];requireArchive(bytes.length===198*208&&snapshots.length===198&&digest(bytes)===report.publicRawHashes[group],'archive public raw length/hash mismatch');publicRaw.push(Buffer.from(bytes));publicStates.push(snapshots.map((s,i)=>restoreFrame(s,bytes.subarray(i*208,(i+1)*208),[`pairA${group}`,`pairB${group}`],i)));}
  for(let step=0;step<198;step++){
   requireArchive(states[step].joints.length===2&&states[step].joints.every((j,i)=>j.id===`hinge${i}`&&j.kind==='hinge'&&j.aId===`pairA${i}`&&j.bId===`pairB${i}`&&Number.isFinite(j.angleRad)),'archive joint identity mismatch');
   for(const group of [0,1]){const single=publicStates[group][step];for(const body of single.bodies){const translated=structuredClone(body);if(group===1)translated.positionM[2]+=1;assert.deepEqual(states[step].bodies.find(b=>b.id===body.id),translated,'archived public isolation body parity');}assert.deepEqual(single.joints,[states[step].joints[group]],'archived public isolation joint parity');}
  }
  rows.push({graph,report,states,raw:Buffer.from(raw),publicStates,publicRaw});
 }
 for(const row of rows.slice(1)){assert.deepEqual(row.states,rows[0].states,'archive source-repeat/compiled states');assert.deepEqual(row.raw,rows[0].raw,'archive source-repeat/compiled raw bits');assert.deepEqual(row.publicStates,rows[0].publicStates,'archive public source-repeat/compiled states');assert.deepEqual(row.publicRaw,rows[0].publicRaw,'archive public source-repeat/compiled raw bits');}
 return {rows,provenance};
}
export async function validateSourcePins(parentRoot,pinsBytes,currentRoot){
 requireArchive(digest(pinsBytes)===SOURCE_FREEZE_SHA,'parent source freeze hash mismatch');const pins=parse(pinsBytes,'source freeze');requireArchive(Object.keys(pins).length===275,'parent source pin count mismatch');
 for(const [path,hash]of Object.entries(pins)){requireArchive(digest(await readFile(resolve(parentRoot,PARENT_DIRECTORY,path)))===hash,`parent source pin mismatch: ${path}`);if(path.startsWith('../../packages/')||path==='../../pnpm-lock.yaml')requireArchive(digest(await readFile(resolve(currentRoot,PARENT_DIRECTORY,path)))===hash,`current original source mismatch: ${path}`);}
 return pins;
}
export async function loadArchive(parentRoot,currentRoot){
 const parent=resolve(parentRoot,PARENT_DIRECTORY),directory=resolve(parent,'evidence/native-82c24a21');
 requireArchive(execFileSync('git',['rev-parse','HEAD'],{cwd:parentRoot,encoding:'utf8'}).trim()===PARENT_NATIVE,'parent native identity mismatch');
 const pinsBytes=await readFile(resolve(parent,'frozen-source.json')),pins=await validateSourcePins(parentRoot,pinsBytes,currentRoot),files=new Map();for(const name of await readdir(directory))files.set(name,await readFile(resolve(directory,name)));
 const decoded=decodeArchive(files),frozenInputs=parse(await readFile(resolve(parent,'frozen-inputs.json')),'parent frozen input');requireArchive(digest(JSON.stringify(frozenInputs.fixture))===frozenInputs.fixtureSha256&&frozenInputs.dt===1/120&&frozenInputs.steps===1200,'parent fixture identity mismatch');
 requireArchive(Object.keys(decoded.provenance.actualOriginalSourceHashes).length===21&&Object.keys(decoded.provenance.actualEmittedDependencyHashes).length===21,'parent original dependency counts mismatch');
 for(const [path,hash]of Object.entries(decoded.provenance.actualOriginalSourceHashes))requireArchive(digest(await readFile(resolve(currentRoot,path)))===hash,'original source dependency mismatch');
 for(const [path,hash]of Object.entries(decoded.provenance.actualEmittedDependencyHashes))requireArchive(digest(await readFile(resolve(currentRoot,path)))===hash,'original emitted dependency mismatch');
 return {...decoded,files,pins,fixture:structuredClone(frozenInputs.fixture),parentRoot};
}
export function selectRecords(input){const records=[];for(const row of input.rows)for(const step of [196,197])for(const group of [0,1])for(const origin of ['private','public-canonical']){
 const config=structuredClone(input.fixture);config.bodies=config.bodies.filter(b=>b.id.endsWith(String(group)));config.joints=config.joints.filter(j=>j.id===`hinge${group}`);if(origin==='public-canonical'&&group===1)for(const body of config.bodies)body.positionM[2]-=1;
 const state=origin==='private'?{...structuredClone(row.states[step]),bodies:structuredClone(row.states[step].bodies.filter(b=>b.id.endsWith(String(group)))),joints:[structuredClone(row.states[step].joints[group])]}:structuredClone(row.publicStates[group][step]);
 records.push({archiveGraph:row.graph,step,group,origin,config,state,rawSha256:digest(rawBodies(state.bodies))});
}requireArchive(records.length===24,'selected record count mismatch');return records;}
