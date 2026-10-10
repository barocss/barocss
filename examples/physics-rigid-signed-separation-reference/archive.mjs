import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {loadArchive as loadCoupledArchive,PARENT,ArchiveError,digest,rawState,validateFiles as validateCoupledFiles} from '../physics-rigid-coupled-position-diagnostic/archive.mjs';
export {PARENT,ArchiveError,digest,rawState,validateCoupledFiles};
export const DIAGNOSTIC={native:'5f9444606dac11dc8087c3073c42cfb574a831a5',measuredSource:'3f66079c2e4acf10d48422d6511b46c031b27ca8',manifestSha256:'89e005c04d48a0397cc4f92bfcf655ae2286b75897c11be457d5b36c8c4c8020',directory:'examples/physics-rigid-coupled-position-diagnostic',artifacts:38,pins:409};
export const ARCHIVE_MESSAGES={manifest:'signed row diagnostic manifest hash mismatch',files:'signed row diagnostic file set mismatch',artifact:'signed row diagnostic artifact hash mismatch',decoded:'signed row diagnostic decoded hash mismatch',proof:'signed row diagnostic correspondence is invalid'};
function guard(value,key){if(!value)throw new ArchiveError(ARCHIVE_MESSAGES[key]);}
export function validateDiagnosticFiles(files){
 const bytes=files.get('manifest.json');guard(Buffer.isBuffer(bytes)&&digest(bytes)===DIAGNOSTIC.manifestSha256,'manifest');const manifest=JSON.parse(bytes);guard(manifest.issue===1308&&manifest.measuredSource===DIAGNOSTIC.measuredSource&&manifest.verdict==='DIAGNOSTIC_GO'&&manifest.sourceUnchanged===true&&manifest.artifacts.length===38,'proof');
 const paths=manifest.artifacts.map(r=>r.path);guard(new Set(paths).size===38&&JSON.stringify([...files.keys()].sort())===JSON.stringify([...paths,'manifest.json'].sort()),'files');const decoded=new Map();
 for(const r of manifest.artifacts){guard(typeof r.path==='string'&&!r.path.startsWith('/')&&!r.path.split('/').includes('..'),'proof');const b=files.get(r.path);guard(Buffer.isBuffer(b)&&b.length===r.bytes&&digest(b)===r.sha256,'artifact');let plain=b;if(r.path.endsWith('.gz')){try{plain=gunzipSync(b);}catch(error){if(error?.code?.startsWith('Z_'))throw new ArchiveError(ARCHIVE_MESSAGES.decoded);throw error;}guard(plain.length===r.decodedBytes&&digest(plain)===r.decodedSha256,'decoded');}decoded.set(r.path,Buffer.from(plain));}
 return {manifest,decoded};
}
export async function loadInputs(root){
 const folder=resolve(root,DIAGNOSTIC.directory),evidence='evidence/native-3f66079c/',manifestBytes=await readFile(resolve(folder,evidence,'manifest.json'));guard(digest(manifestBytes)===DIAGNOSTIC.manifestSha256,'manifest');const manifest=JSON.parse(manifestBytes),files=new Map([['manifest.json',manifestBytes]]);
 for(const row of manifest.artifacts){guard(typeof row.path==='string'&&!row.path.startsWith('/')&&!row.path.split('/').includes('..'),'proof');files.set(row.path,await readFile(resolve(folder,row.path)));}const checked=validateDiagnosticFiles(files);
 assert.deepEqual((await readdir(resolve(folder,evidence))).sort(),[...manifest.artifacts.filter(r=>r.path.startsWith(evidence)).map(r=>r.path.slice(evidence.length)),'manifest.json'].sort());
 const frozenBytes=await readFile(resolve(folder,'source-freeze.json')),frozen=JSON.parse(frozenBytes);assert.equal(frozen.sources.length,409);
 // Historical pins stay historical; fresh current helper pins belong to this lane's full freeze.
 for(const row of frozen.sources){const original=execFileSync('git',['show',`${DIAGNOSTIC.measuredSource}:${row.path}`],{cwd:root});assert.equal(digest(original),row.sha256,`historical diagnostic source: ${row.path}`);if(row.path.startsWith(DIAGNOSTIC.directory+'/'))assert.equal(digest(await readFile(resolve(root,row.path))),row.sha256,`adopted diagnostic source: ${row.path}`);}
 const input=await loadCoupledArchive(resolve(root,'examples/physics-rigid-coupled-position-world')),oldPins=JSON.parse(input.files.get('evidence/native-ecc4dccc/source-freeze.json'));assert.equal(oldPins.sources.length,356);
 for(const {path,sha256}of oldPins.sources){const full=resolve(root,path),repositoryPath=relative(root,full);assert.ok(!repositoryPath.startsWith('..'));assert.equal(digest(execFileSync('git',['show',`${PARENT.native}:${repositoryPath}`],{cwd:root})),sha256,`historical coupled source: ${repositoryPath}`);if(repositoryPath.startsWith('examples/physics-rigid-coupled-position-world/'))assert.equal(digest(await readFile(full)),sha256,`adopted coupled source: ${repositoryPath}`);}
 const summary=JSON.parse(checked.decoded.get(evidence+'summary.json.gz'));assert.equal(summary.diagnosticGO,true);assert.equal(summary.actualPairFrameObservations,972);assert.equal(summary.actualCoverageTransitions,324);assert.equal(summary.actualLinearProblems,9);assert.equal(summary.worldStepped,false);
 for(const row of input.rows){const report=JSON.parse(checked.decoded.get(evidence+row.graph+'-'+row.scene+'-report.json.gz')),raw=checked.decoded.get(evidence+row.graph+'-'+row.scene+'-frames.f64le');guard(report.diagnosticGO===true&&report.problem.rows.length===row.problem.rows.length&&JSON.stringify(report.problem)===JSON.stringify(row.problem)&&report.frames.length===3&&report.transitions.length===36&&raw.length===2808&&digest(raw)===report.rawFrameSha256,'proof');for(const [i,key]of ['previous','preCoupled','final'].entries())guard(raw.subarray(i*936,(i+1)*936).equals(row.rawSlices[key])&&digest(row.rawSlices[key])===report.rawFrameHashes[key],'proof');row.diagnostic=report;}
 return {...input,diagnostic:{native:DIAGNOSTIC.native,measuredSource:DIAGNOSTIC.measuredSource,manifestSha256:DIAGNOSTIC.manifestSha256,sourceFreezeSha256:digest(frozenBytes),sourcePins:409,artifacts:38,filesMap:files},coupledSourcePins:356};
}
