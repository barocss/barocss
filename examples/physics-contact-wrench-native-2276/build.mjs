import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),producer=resolve(root,'examples/physics-contact-wrench-producer-2276'),qualified=resolve(producer,'evidence/build-01');
const id=process.argv[2];assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''),'fresh native build ID required');
mkdirSync(resolve(home,'evidence'),{recursive:true});const out=resolve(home,'evidence',id);mkdirSync(out);
const hash=b=>createHash('sha256').update(b).digest('hex'),pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:hash(b)};};
const put=(n,x)=>writeFileSync(resolve(out,n),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const tree=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tree(resolve(p,e.name)):[resolve(p,e.name)]).sort();
const result={status:'BUILD_NOT_COMPLETED',scope:'PRIVATE_EMITTED_NODE_NEXT_ONLY',WorldCalls:0,commands:[],own:{},modelBuilder:null,entry:'emitted/entry.js',emittedFiles:{},nativeHarnessPins:{},existingTypecheckDirectives:[],newRuntimeTypecheckSuppressions:0};let phase='authenticate-qualified-source';
function run(label,args){const child=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:150000,maxBuffer:16*1024*1024});writeFileSync(resolve(out,label+'.stdout'),child.stdout??'',{flag:'wx'});writeFileSync(resolve(out,label+'.stderr'),child.stderr??'',{flag:'wx'});result.commands.push({label,executable:process.execPath,args,status:child.status,signal:child.signal,error:child.error?.message??null,stdout:pin(resolve(out,label+'.stdout')),stderr:pin(resolve(out,label+'.stderr'))});assert.equal(child.status,0,label+' failed; preserve full diagnostics');}
try{
 const sourceResult=JSON.parse(readFileSync(resolve(qualified,'result.json'))),sourceSummary=JSON.parse(readFileSync(resolve(producer,'evidence/producer-01/summary.json')));
 assert.equal(sourceResult.status,'PASS_PRIVATE_PHASE_BUILD');assert.equal(sourceSummary.status,'EXECUTED_PASS_SOURCE_PRIVATE_PRODUCER');
 for(const[n,v]of Object.entries(sourceResult.own))assert.deepEqual(pin(resolve(producer,n)),v,'Qualified implementation drift: '+n);
 assert.deepEqual(pin(resolve(qualified,'source.mjs')),sourceResult.source);for(const[n,v]of Object.entries(sourceResult.staged))assert.deepEqual(pin(resolve(qualified,'stage',n)),v,'Qualified stage drift: '+n);
 const transfer=JSON.parse(readFileSync(resolve(home,'RUNNER-TRANSFER.json')));assert.deepEqual(pin(resolve(producer,'run.mjs')),transfer.sourcePin);assert.deepEqual(pin(resolve(home,'run.mjs')),transfer.newPin);
 for(const n of ['encoding.mjs','observer.py','trace_decode.py'])assert.deepEqual(pin(resolve(home,n)),pin(resolve(producer,n)),'Unchanged independent helper copy: '+n);
 result.own=sourceResult.own;result.modelBuilder=sourceResult.modelBuilder;assert.deepEqual(pin(resolve(root,'examples/physics-model-input/model.mjs')),result.modelBuilder);
 result.qualified={buildReceipt:pin(resolve(qualified,'result.json')),summary:pin(resolve(producer,'evidence/producer-01/summary.json')),sourceBundle:pin(resolve(qualified,'source.mjs')),providerManifest:sourceResult.manifest};
 for(const n of ['CONTRACT.md','package.json','build.mjs','run.mjs','consumer-template.mts','encoding.mjs','observer.py','trace_decode.py','RUNNER-TRANSFER.json','RUNNER-TRANSFER.diff'])result.nativeHarnessPins[n]=pin(resolve(home,n));
 phase='authenticate-installed-typescript';const toolFile=resolve(root,'examples/physics-rigid-rotation-g1-2276/TOOLCHAIN-PINS-02.json'),tools=JSON.parse(readFileSync(toolFile));
 for(const[path,v]of Object.entries(tools.toolFiles))assert.deepEqual(pin(path),v,'Installed tool drift: '+path);
 assert.equal(realpathSync(process.execPath),realpathSync(tools.tools.node),'Use pinned Node executable');const tsc=realpathSync(tools.tools.typescriptCLI);result.toolchain={receipt:pin(toolFile),typescriptCLI:tsc,node:process.execPath,nodeTypesRoot:tools.tools.nodeTypeRoot};
 phase='copy-immutable-stage';const stage=resolve(out,'stage'),emitted=resolve(out,'emitted');cpSync(resolve(qualified,'stage'),stage,{recursive:true});
 for(const[n,v]of Object.entries(sourceResult.staged))assert.deepEqual(pin(resolve(stage,n)),v,'Copied stage drift: '+n);
 const tsFiles=tree(stage).filter(p=>p.endsWith('.ts'));
 for(const path of tsFiles){const lines=readFileSync(path,'utf8').split('\n');for(let i=0;i<lines.length;i++)if(/@ts-(?:nocheck|ignore|expect-error)/.test(lines[i]))result.existingTypecheckDirectives.push({file:relative(stage,path),line:i+1,text:lines[i].trim(),priorNonCommentSource:lines.slice(0,i).some(line=>line.trim()&&!line.trim().startsWith('//'))});}
 result.typecheckBoundary='strict/noEmitOnError applies; existing source directives remain byte-identical. Modules with effective @ts-nocheck are not fully typechecked. No added/moved suppression.';
 const config={compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],strict:true,declaration:true,skipLibCheck:true,noEmitOnError:true,rootDir:stage,outDir:emitted,types:['node'],typeRoots:[tools.tools.nodeTypeRoot]},files:tsFiles};put('runtime.tsconfig.json',config);put('input-pins.json',{qualified:result.qualified,originalStage:sourceResult.staged,nativeHarness:result.nativeHarnessPins,existingTypecheckDirectives:result.existingTypecheckDirectives});
 phase='strict-compile';run('compile',[tsc,'-p',resolve(out,'runtime.tsconfig.json'),'--pretty','false','--listFiles']);
 phase='audit-emitted-files';
 for(const p of tree(emitted))result.emittedFiles[relative(out,p)]=pin(p);
 assert(result.emittedFiles[result.entry],'Actual emitted entry.js is required');assert(result.emittedFiles['emitted/entry.d.ts'],'Declarations are required');
 for(const path of tree(emitted).filter(p=>p.endsWith('.js'))){const text=readFileSync(path,'utf8');for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)){const spec=match[1];if(spec.startsWith('node:'))continue;assert(spec.startsWith('.')&&spec.endsWith('.js'),'Non-native output dependency: '+spec);const target=resolve(dirname(path),spec);assert(target.startsWith(emitted+'/'),'Output graph escapes emitted closure');assert(result.emittedFiles[relative(out,target)],'Missing emitted module: '+spec);}}
 phase='strict-declaration-consumer';const template=readFileSync(resolve(home,'consumer-template.mts'),'utf8');assert.equal(template.split('__NATIVE_ENTRY__').length-1,2);writeFileSync(resolve(out,'consumer.mts'),template.replaceAll('__NATIVE_ENTRY__',resolve(out,result.entry)),{flag:'wx'});
 put('consumer.tsconfig.json',{compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],strict:true,skipLibCheck:true,noEmit:true,noEmitOnError:true,types:['node'],typeRoots:[tools.tools.nodeTypeRoot]},files:[resolve(out,'consumer.mts')]});
 run('consumer',[tsc,'-p',resolve(out,'consumer.tsconfig.json'),'--pretty','false']);
 result.status='PASS_PRIVATE_NATIVE_EMITTED_BUILD';
}catch(error){result.status='FAIL_PRIVATE_NATIVE_EMITTED_BUILD';result.firstFailure={phase,name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
put('result.json',result);console.log(JSON.stringify({status:result.status,firstFailure:result.firstFailure??null,commands:result.commands,existingTypecheckDirectives:result.existingTypecheckDirectives,WorldCalls:0}));
