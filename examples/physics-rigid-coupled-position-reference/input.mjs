import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {digest,loadArchive,rawState,restoreState,ArchiveError} from '../physics-rigid-feature-penetration-diagnostic/archive.mjs';
export {digest,rawState};
const diagnosticManifest='008417caebec6c3e698dfb57a03295ab2f131c2337f875ab8b74d606aa5326ef';
function check(c,m){if(!c)throw new ArchiveError(m);}
export function validateDiagnosticFiles(files){
  check(files.has('manifest.json')&&digest(files.get('manifest.json'))===diagnosticManifest,'diagnostic manifest hash mismatch');
  const manifest=JSON.parse(files.get('manifest.json'));
  check(Object.keys(manifest).length===29&&JSON.stringify([...files.keys()].sort())===JSON.stringify([...Object.keys(manifest),'manifest.json'].sort()),'diagnostic file set mismatch');
  for(const [name,hash]of Object.entries(manifest))check(digest(files.get(name))===hash,'diagnostic file hash mismatch');
  return manifest;
}
export async function loadInputs(root){
  const parent=resolve(root,'examples/physics-rigid-feature-contact-reference/evidence/native-665aa5ae'),diag=resolve(root,'examples/physics-rigid-feature-penetration-diagnostic'),freeze=JSON.parse(await readFile(resolve(diag,'frozen-inputs.json')));
  const archive=await loadArchive(parent,freeze,root),directory=resolve(diag,'evidence/native-85e23b70'),files=new Map();for(const name of await readdir(directory))files.set(name,await readFile(resolve(directory,name)));validateDiagnosticFiles(files);
  const provenance=JSON.parse(files.get('provenance.json'));
  check(provenance.measuredHead==='85e23b70767f1fb7beb1e800877414f712081b5c'&&provenance.consumerExit===0&&provenance.affectedBuildExit===0&&provenance.strictTypesExit===0&&provenance.detectorAgreement===true&&provenance.pairObservations===648,'diagnostic provenance mismatch');
  check(digest(await readFile(resolve(diag,'frozen-source.json')))===provenance.sourceFreezeSha256,'diagnostic source freeze drift');
  for(const [path,hash]of Object.entries(provenance.frozenSourceAndReuseHashes))check(digest(await readFile(resolve(diag,path)))===hash,'diagnostic source drift');
  const first=[];
  for(const r of archive.rows){
    const name=`${r.graph}-${r.scene}-report.json`,bytes=gunzipSync(files.get(name+'.gz'));
    check(digest(bytes)===provenance.uncompressedArtifactHashes[name],'diagnostic report hash mismatch');const report=JSON.parse(bytes),raw=files.get(`${r.graph}-${r.scene}-frames.f64le`);
    check(report.graph===r.graph&&report.scene===r.scene&&report.detectorAgreement===true&&report.frames.length===2&&digest(raw)===report.rawSha256,'diagnostic report identity mismatch');
    const frame=report.frames[1],state=r.states.at(-1);assert.deepEqual(raw.subarray(936),rawState(state));frame.state=restoreState(frame.state,raw.subarray(936),r.report.ids,state.stepIndex);assert.deepEqual(rawState(frame.state),rawState(state));assert.deepEqual(frame.state,state);
    first.push({graph:r.graph,scene:r.scene,config:r.report.config,state:structuredClone(state),diagnostic:frame});
  }
  return {first,archive,diagnosticFiles:files,freeze};
}
