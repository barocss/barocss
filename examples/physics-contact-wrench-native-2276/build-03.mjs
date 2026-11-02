import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {auditEntryGraph} from './entry-graph-03.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),paid=resolve(home,'evidence/native-02');
const id=process.argv[2];assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''),'fresh continuation ID required');
mkdirSync(resolve(home,'evidence'),{recursive:true});const out=resolve(home,'evidence',id);mkdirSync(out);
const hash=b=>createHash('sha256').update(b).digest('hex'),pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:hash(b)};},put=(n,x)=>writeFileSync(resolve(out,n),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const tree=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tree(resolve(p,e.name)):[resolve(p,e.name)]).sort();
let phase='authenticate-paid-compile',result={status:'NOT_COMPLETED',scope:'PRIVATE_TYPED_SOURCE_AND_EMITTED_CONTINUATION_03',WorldCalls:0,commands:[],runtimeCompileRepeated:false};
function command(label,exe,args){const child=spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout:150000,maxBuffer:16*1024*1024});writeFileSync(resolve(out,label+'.stdout'),child.stdout??'',{flag:'wx'});writeFileSync(resolve(out,label+'.stderr'),child.stderr??'',{flag:'wx'});result.commands.push({label,executable:exe,args,status:child.status,signal:child.signal,error:child.error?.message??null,stdout:pin(resolve(out,label+'.stdout')),stderr:pin(resolve(out,label+'.stderr'))});assert.equal(child.status,0,label+' failed; preserve full diagnostics');}
try{
 const before=JSON.parse(readFileSync(resolve(paid,'result.json'))),freeze=JSON.parse(readFileSync(resolve(home,'FREEZE-03.json')));
 assert.equal(before.status,'FAIL_PRIVATE_TYPED_DUAL_GRAPH_BUILD');assert.equal(before.firstFailure.phase,'audit-emitted-files');assert.equal(before.firstFailure.message,'Non-native output dependency: @barocss/cad');
 const compile=before.commands.find(x=>x.label==='compile');assert.equal(compile.status,0);assert.equal(before.commands.length,1);assert(!/error TS\d+/.test(readFileSync(resolve(paid,'compile.stdout'),'utf8')));assert.deepEqual(pin(resolve(paid,'compile.stdout')),compile.stdout);assert.deepEqual(pin(resolve(paid,'compile.stderr')),compile.stderr);
 for(const[n,v]of Object.entries(freeze.paidCompileFiles))assert.deepEqual(pin(resolve(home,n)),v,'Paid native02 evidence drift: '+n);
 for(const[n,v]of Object.entries(freeze.files))assert.deepEqual(pin(resolve(home,n)),v,'Continuation source drift: '+n);
 for(const[n,v]of Object.entries(before.typedStage))assert.deepEqual(pin(resolve(paid,'stage',n)),v,'Paid typed stage drift: '+n);
 for(const[n,v]of Object.entries(before.emittedFiles))assert.deepEqual(pin(resolve(paid,n)),v,'Paid emitted module drift: '+n);
 assert.equal(Object.keys(before.emittedFiles).length,198);assert.equal(Object.keys(before.typedStage).length,100);
 result={...before,status:'NOT_COMPLETED',scope:'PRIVATE_TYPED_SOURCE_AND_EMITTED_CONTINUATION_03',commands:[],runtimeCompileRepeated:false,reusedRuntimeCompile:{status:'PASS_STRICT_COMPILE_ZERO_DIAGNOSTICS',paidReceipt:pin(resolve(paid,'result.json')),command:compile,stageFiles:100,emittedFiles:198},nativeHarnessPins:freeze.files};delete result.firstFailure;
 phase='copy-paid-stage-and-emit';cpSync(resolve(paid,'stage'),resolve(out,'stage'),{recursive:true});cpSync(resolve(paid,'emitted'),resolve(out,'emitted'),{recursive:true});
 for(const[n,v]of Object.entries(before.typedStage))assert.deepEqual(pin(resolve(out,'stage',n)),v);
 for(const[n,v]of Object.entries(before.emittedFiles))assert.deepEqual(pin(resolve(out,n)),v);
 const toolsPath=resolve(root,'examples/physics-rigid-rotation-g1-2276/TOOLCHAIN-PINS-02.json'),tools=JSON.parse(readFileSync(toolsPath));assert.deepEqual(pin(toolsPath),before.toolchain.receipt);assert.equal(realpathSync(process.execPath),realpathSync(tools.tools.node));for(const[path,v]of Object.entries(tools.toolFiles))assert.deepEqual(pin(path),v);
 phase='actual-entry-graph-audit';const apiPath=freeze.parserApi.path;assert.deepEqual(pin(apiPath),{bytes:freeze.parserApi.bytes,sha256:freeze.parserApi.sha256});const ts=createRequire(import.meta.url)(apiPath);
 const audit=auditEntryGraph(out,before.entry,before.emittedFiles,ts);put('entry-graph-audit.json',audit);assert.equal(audit.status,'PASS_ACTUAL_ENTRY_REACHABLE_CLOSED_JS_GRAPH');result.entryGraphAudit=audit;result.parserApi=freeze.parserApi;
 phase='strict-declaration-consumer';const template=readFileSync(resolve(home,'consumer-template.mts'),'utf8');assert.equal(template.split('__NATIVE_ENTRY__').length-1,2);writeFileSync(resolve(out,'consumer.mts'),template.replaceAll('__NATIVE_ENTRY__',resolve(out,result.entry)),{flag:'wx'});
 put('consumer.tsconfig.json',{compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],strict:true,skipLibCheck:true,noEmit:true,noEmitOnError:true,types:['node'],typeRoots:[tools.tools.nodeTypeRoot]},files:[resolve(out,'consumer.mts')]});
 command('consumer',process.execPath,[realpathSync(tools.tools.typescriptCLI),'-p',resolve(out,'consumer.tsconfig.json'),'--pretty','false']);
 phase='same-identity-amended-source-bundle';command('source',realpathSync(tools.tools.esbuildBinary),[resolve(out,'stage/entry.ts'),'--bundle','--platform=node','--format=esm','--target=es2022','--outfile='+resolve(out,'source.mjs'),'--metafile='+resolve(out,'source-metafile.json')]);
 result.source=pin(resolve(out,'source.mjs'));result.sourceEntry='source.mjs';const sourceMeta=JSON.parse(readFileSync(resolve(out,'source-metafile.json')));for(const input of Object.keys(sourceMeta.inputs))assert(realpathSync(resolve(root,input)).startsWith(realpathSync(resolve(out,'stage'))+'/'),'Source bundle escaped paid typed stage');
 result.status='PASS_PRIVATE_TYPED_DUAL_GRAPH_BUILD';
}catch(error){result.status='FAIL_PRIVATE_TYPED_CONTINUATION_03';result.firstFailure={phase,name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
put('result.json',result);console.log(JSON.stringify({status:result.status,firstFailure:result.firstFailure??null,runtimeCompileRepeated:false,WorldCalls:0,commands:result.commands,entryGraph:result.entryGraphAudit?{reachable:result.entryGraphAudit.reachableModules,unreachable:result.entryGraphAudit.unreachableModules,unreachableExternalDependencies:result.entryGraphAudit.unreachableExternalDependencies}:null}));
