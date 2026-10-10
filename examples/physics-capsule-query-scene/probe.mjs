import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile,mkdir,writeFile,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname,resolve,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { families,publishedResolver } from '../workspace-source/probe.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),mode=process.argv[2],output=resolve(process.argv[3]??'/tmp/physics-1062-'+mode);
assert.ok(['source','compiled'].includes(mode));
const metadata={work_id:1062,mode,nodeVersion:process.version,gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()};
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 const manifest=JSON.parse(await readFile(resolve(root,'packages/barocss-physics/package.json'),'utf8')),targets=[];
 for(const [entry,value]of Object.entries(manifest.publishConfig.exports))for(const kind of ['import','types']){assert.ok(value[kind].startsWith('./dist/'));const path=resolve(root,'packages/barocss-physics',value[kind]);assert.ok((await stat(path)).isFile());targets.push({entry,kind,path:relative(root,path)});}
 const declaration=await readFile(resolve(root,'packages/barocss-physics/dist/index.d.ts'),'utf8');
 for(const name of ['createUprightCapsuleQuery','CapsuleQueryBoxV1','CapsuleQuerySceneV1','CapsuleSweepInputV1','CapsuleSweepHitV1','UprightCapsuleQuery'])assert.ok(declaration.includes(name));
 const published=mode==='compiled'?await publishedResolver():null;
 const bundle=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.mjs')],bundle:true,write:false,platform:'node',format:'esm',target:'es2022',metafile:true,...(published?{plugins:[published.plugin]}:{})});
 const own=Object.keys(bundle.metafile.inputs).map(p=>resolve(root,p)).filter(p=>families.some(f=>p.startsWith(f.directory+'/'))),source=own.filter(p=>p.includes('/src/')),compiled=own.filter(p=>p.includes('/dist/'));
 assert.ok(own.length>0);assert.equal(mode==='source'?compiled.length:source.length,0);
 const flow=JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:bundle.outputFiles[0].text,cwd:root,encoding:'utf8',maxBuffer:24*1024*1024}));
 const inputs=Buffer.from(flow.inputHex,'hex'),outputs=Buffer.from(flow.outputHex,'hex');
 const nativeFolders=['physics-capsule-reuse-reference/evidence/node','physics-capsule-distinct-reference/evidence/node'].map(p=>resolve(root,'examples',p));
 const nativeInputs=Buffer.concat(await Promise.all(nativeFolders.map(p=>readFile(resolve(p,'inputs.f64.bin'))))),nativeOutputs=Buffer.concat(await Promise.all(nativeFolders.map(p=>readFile(resolve(p,'outputs.f64.bin')))));
 const exactNativeInputs=inputs.equals(nativeInputs),exactNativeOutputs=outputs.equals(nativeOutputs);
 const files=[];for(const [file,bytes]of[['inputs.f64.bin',inputs],['outputs.f64.bin',outputs]]){await writeFile(resolve(output,file),bytes);files.push({file,type:'Float64Array',elements:bytes.length/8,bytes:bytes.length,sha256:hash(bytes)});}
 const {inputHex,outputHex,...observations}=flow;
 const report={...metadata,...observations,exactNativeInputs,exactNativeOutputs,candidateGO:flow.passed&&exactNativeInputs&&exactNativeOutputs,
 resolution:{sourceFiles:source.length,compiledFiles:compiled.length,ownInputs:own.map(p=>relative(root,p))},targets,newRootDeclarations:true,
 sourceAliases:false,sourceCustomConditions:false,sourceResolverPlugin:false,compiledResolver:published?'complete transitive publishConfig exports':null,...(published?{publishedResolutions:published.resolutions}:{})};
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(resolve(output,'manifest.json'),JSON.stringify({...metadata,format:'capsule-sweep-raw-v1',endianness:'little',files,totalRawBytes:inputs.length+outputs.length},null,2)+'\n');
 console.log(JSON.stringify({...metadata,output,candidateGO:report.candidateGO,numericalPassed:flow.numericalPassed,exactRepeat:flow.exactRepeat,controlsPassed:flow.controls.passed,errors:flow.controls.errors.length,exactNativeInputs,exactNativeOutputs,resolution:{sourceFiles:source.length,compiledFiles:compiled.length},timing:flow.timing?.medianAndSpread}));
 if(!report.candidateGO)process.exitCode=1;
}catch(error){const failure={...metadata,passed:false,firstFailure:String(error.stack??error),stdout:error.stdout?String(error.stdout):null,stderr:error.stderr?String(error.stderr):null};await writeFile(resolve(output,'failure.json'),JSON.stringify(failure,null,2)+'\n');console.log(JSON.stringify(failure));process.exitCode=1;}
