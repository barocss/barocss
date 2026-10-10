import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {families,publishedResolver} from '../workspace-source/probe.mjs';
const here=dirname(fileURLToPath(import.meta.url));export const root=resolve(here,'../..');
export async function bundle(mode,entry,platform){const published=mode==='compiled'?await publishedResolver():null;
 const coreMap={name:'internal-emitted-production-core',setup(builder){builder.onResolve({filter:/packages\/barocss-physics\/src\/character\/core\.js$/},()=>({path:resolve(root,'packages/barocss-physics/dist/character/core.js')}));}};
 const result=await build({absWorkingDir:root,entryPoints:[resolve(here,entry)],bundle:true,write:false,platform,format:'esm',target:'es2022',metafile:true,...(published?{plugins:[published.plugin,coreMap]}:{})});
 const own=Object.keys(result.metafile.inputs).map(p=>resolve(root,p)).filter(p=>families.some(f=>p.startsWith(f.directory+'/'))),src=own.filter(p=>p.includes('/src/')),dist=own.filter(p=>p.includes('/dist/'));
 assert.ok(own.length);assert.equal(mode==='source'?dist.length:src.length,0);
 return {bytes:result.outputFiles[0].contents,text:result.outputFiles[0].text,resolution:{sourceFiles:src.length,compiledFiles:dist.length,ownInputs:own.map(p=>relative(root,p)),sourceResolverPlugin:false,sourceCustomConditions:false,compiledResolver:published?'complete transitive publishConfig plus explicit private emitted core':null,...(published?{publishedResolutions:published.resolutions}:{})}};}
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const metadata=()=>({work_id:1064,nodeVersion:process.version,gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()});
export async function save(output,flow,meta){await mkdir(output,{recursive:true});const inputs=Buffer.from(flow.inputHex,'hex'),outputs=Buffer.from(flow.outputHex,'hex'),publicStates=Buffer.from(flow.publicStateHex,'hex');
 const exactNativeInputs=inputs.equals(await readFile(resolve(here,'selected-inputs.f64.bin'))),exactNativeOutputs=outputs.equals(await readFile(resolve(here,'selected-outputs.f64.bin')));
 const {inputHex,outputHex,publicStateHex,...data}=flow,report={...meta,...data,exactNativeInputs,exactNativeOutputs,candidateGO:flow.candidateGO&&exactNativeInputs&&exactNativeOutputs};
 await writeFile(resolve(output,'report.json.gz'),gzipSync(JSON.stringify(report)));const files=[];for(const [file,bytes]of[['inputs.f64.bin',inputs],['outputs.f64.bin',outputs]]){await writeFile(resolve(output,file),bytes);files.push({file,type:'Float64Array',bytes:bytes.length,elements:bytes.length/8,sha256:hash(bytes)});}
 await writeFile(resolve(output,'public-states.f64.bin'),publicStates);await writeFile(resolve(output,'manifest.json'),JSON.stringify({...meta,format:'character-movement-reference-raw-v1',endianness:'little',files,totalRawBytes:inputs.length+outputs.length,negativeZeroInputOffsets:flow.negativeZeroInputOffsets,negativeZeroOutputOffsets:flow.negativeZeroOutputOffsets,publicStates:{bytes:publicStates.length,sha256:hash(publicStates)}},null,2)+'\n');return report;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const mode=process.argv[2],output=resolve(process.argv[3]);assert.ok(['source','compiled'].includes(mode));const meta=metadata();await mkdir(output,{recursive:true});
 try{const manifest=JSON.parse(await readFile(resolve(root,'packages/barocss-physics/package.json'),'utf8'));for(const value of Object.values(manifest.publishConfig.exports))for(const kind of ['import','types']){assert.ok(value[kind].startsWith('./dist/'));assert.ok((await stat(resolve(root,'packages/barocss-physics',value[kind]))).isFile());}
 const declaration=await readFile(resolve(root,'packages/barocss-physics/dist/index.d.ts'),'utf8');for(const name of ['createUprightCapsuleController','CapsuleControllerConfigV1','CapsuleControllerStepV1','CapsuleControllerStateV1','CapsuleControllerSupportV1','CapsuleControllerAssistV1','UprightCapsuleController'])assert.ok(declaration.includes(name));
 const built=await bundle(mode,'entry.mjs','node');const flow=JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:built.text,cwd:root,encoding:'utf8',env:process.env,maxBuffer:48*1024*1024}));const report=await save(output,flow,{...meta,mode,resolution:built.resolution});console.log(JSON.stringify({...meta,mode,output,candidateGO:report.candidateGO,controls:flow.controls.records.length,numericalPassed:flow.numericalPassed,selectedProjectionExact:flow.selectedProjectionExact,exactNativeOutputs:report.exactNativeOutputs,resolution:{sourceFiles:built.resolution.sourceFiles,compiledFiles:built.resolution.compiledFiles},maxP95Ms:flow.timing?Math.max(...flow.timing.trials.flat().map(t=>t.p95Ms)):null,failures:flow.first.filter(c=>!c.passed).map(c=>({name:c.name,error:c.error,metrics:c.metrics}))}));if(!report.candidateGO)process.exitCode=1;
 }catch(e){const failure={...meta,mode,firstFailure:String(e.stack??e),stdout:e.stdout?String(e.stdout):null,stderr:e.stderr?String(e.stderr):null};await writeFile(resolve(output,'failure.json'),JSON.stringify(failure,null,2));console.log(JSON.stringify(failure));process.exitCode=1;}}
