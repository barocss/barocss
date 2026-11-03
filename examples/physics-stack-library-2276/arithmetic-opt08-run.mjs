// Root alone executes under its existing180s owned guard. No public API changes.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,openSync,readSync,closeSync,copyFileSync,realpathSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),node='/Users/user/.volta/tools/image/node/22.19.0/bin/node';
const EXPECTED_TESTS=32; // Frozen independent exact hex/power/word/refusal bank.
assert.ok(EXPECTED_TESTS>0,'OPT08 fixed case bank not yet frozen');
const id=process.argv[2];assert.match(id??'',/^arithmetic-opt08-[a-z0-9-]{1,48}$/);const out=join(home,'evidence',id);assert.ok(!existsSync(out),'new arithmetic receipt ID required');mkdirSync(out);
const hash=p=>{const h=createHash('sha256'),b=Buffer.alloc(64*1024),fd=openSync(p,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const put=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');
const baseline=join(home,'evidence/canonical-opt07-01/canonical-provider/dist/stack/strict-line.js');
const baselineHash='b4b9b84f02cd42d3f8a974ebdcaa959aa5f9c652900c41fba483793706c2708e';
const baselinePackage=join(home,'evidence/canonical-opt07-01/canonical-provider/package.json'),baselinePackageHash='7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330';
assert.equal(hash(baselinePackage),baselinePackageHash,'immutable actual OPT07 package metadata');
assert.equal(hash(join(home,'baseline/strict-line-opt07.ts')),'4c6cc8b397cb2095a255cd61e33c3050e07d5a4c933f5c7d9d896764d154606b','preserved original OPT07 source');
assert.equal(hash(join(root,'packages/barocss-physics/src/stack/strict-line.ts')),'4c6cc8b397cb2095a255cd61e33c3050e07d5a4c933f5c7d9d896764d154606b','production remains immutable OPT07');
assert.equal(hash(join(home,'candidate-strict-line-opt08.ts')),'debc13349c9d45b2dc9f8e7f59e779156928953892c41b372e7a3f5339e415ce','isolated OPT08 candidate bytes');
const oldSource=readFileSync(join(home,'baseline/strict-line-opt07.ts'),'utf8');
const oldImport="import type { Body, Vec3 } from '../internal-types.js';",newImport="import type { Body, Vec3 } from '../../packages/barocss-physics/src/internal-types.js';";
const oldChecked='    const bits = (value < 0n ? -value : value).toString(2).length;';
const newChecked='    const hex = (value < 0n ? -value : value).toString(16), first = hex.charCodeAt(0);\n    const bits = 4*(hex.length-1) + (first <= 49 ? 1 : first <= 51 ? 2 : first <= 55 ? 3 : 4);';
assert.equal(oldSource.split(oldImport).length,2,'one type-only import relocation');assert.equal(oldSource.split(oldChecked).length,2,'one checked-expression replacement');
assert.equal(readFileSync(join(home,'candidate-strict-line-opt08.ts'),'utf8'),oldSource.replace(oldImport,newImport).replace(oldChecked,newChecked),'entire candidate equals actual preserved OPT07 except the two authorized textual changes');
assert.equal(realpathSync(process.execPath),realpathSync(node));assert.equal(hash(node),'0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1');assert.equal(hash(baseline),baselineHash);
const require=createRequire(join(root,'package.json')),tsc=require.resolve('typescript/lib/tsc.js'),esbuild=require.resolve('esbuild'),esbuildNative=createRequire(esbuild).resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild');
const deadline=Date.now()+170000,receipt={status:'RUNNING',stage:'freeze',commands:[],firstFailure:null,fullPrefix:'NOT_RUN',publicAPI:false,resourceQualification:false};let frozen;
const remaining=()=>{const n=Math.floor(deadline-Date.now());assert.ok(n>0,'internal170s deadline');return n;};
const verify=()=>{const after=Object.fromEntries(Object.keys(frozen).map(p=>[p,hash(p)]));put('inputs-after.json',after);assert.deepEqual(after,frozen,'frozen source/tool/baseline bytes changed');};
const timer=setTimeout(()=>{receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.stage,message:'internal170s deadline'};put('result.json',receipt);process.exit(1);},remaining());
function command(stage,args){
 receipt.stage=stage;put('progress.json',receipt);const timeout=remaining(),result=spawnSync(node,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:2*1024*1024,env:{...process.env,NODE_DISABLE_COMPILE_CACHE:'1',STRICT_LINE_BASELINE_MODULE:baseline}});
 writeFileSync(join(out,stage+'.stdout'),result.stdout??'');writeFileSync(join(out,stage+'.stderr'),result.stderr??'');receipt.commands.push({stage,args,timeoutMs:timeout,exit:result.status,signal:result.signal,error:result.error?.message});put('progress.json',receipt);assert.equal(result.status,0,stage+' failed; stop before later graph');
 if(stage.endsWith('-tests'))assert.match(result.stdout,new RegExp('# tests '+EXPECTED_TESTS+'\\b'),'all fixed OPT08 tests executed');
}
try{
 const manifest=JSON.parse(readFileSync(join(home,'OPTIMIZATION-08.json'),'utf8'));
 for(const [name,expected]of Object.entries(manifest.files))assert.equal(hash(join(home,name)),expected,'frozen OPT08 component '+name);
 const metadata=[join(root,'package.json'),join(root,'packages/barocss-physics/package.json'),baselinePackage];
 const owned=[fileURLToPath(import.meta.url),join(home,'arithmetic-opt08.test.mts'),join(home,'candidate-strict-line-opt08.ts')],tools=[node,tsc,resolve(dirname(tsc),'_tsc.js'),esbuild,esbuildNative];
 const inputs=[...files(join(root,'packages/barocss-physics/src')),...owned,...metadata,...tools,baseline,join(home,'baseline/strict-line-opt07.ts'),join(home,'OPTIMIZATION-08-CONTRACT.md'),join(home,'OPTIMIZATION-08.json')];
 frozen=Object.fromEntries([...new Set(inputs)].map(p=>[p,hash(p)]));put('inputs-before.json',frozen);
 put('baseline-origin.json',{path:baseline,sha256:baselineHash,origin:'ACTUAL_OPT07_CANONICAL_BUILD10_IMMUTABLE_SNAPSHOT',runtimeImports:0,packageMetadata:{path:baselinePackage,sha256:baselinePackageHash},productionFallback:false,isolatedCandidate:true,productionAdopted:false,fixedAnalyticContract:'examples/physics-stack-library-2276/OPTIMIZATION-08-CONTRACT.md',baselineScope:'Actual canonical OPT07 Arithmetic including owned sumSquare',counterParity:'REQUIRED exactly: all counters, checked peaks including oversized, failure order, actual work admission and words',fixedCaps:{rationalOperations:200000,integerOperations:2000000,integerBits:16384,roundingSteps:16}});
 const native=join(out,'native-modules');mkdirSync(native);copyFileSync(metadata[0],join(native,'package.json'));mkdirSync(join(native,'packages/barocss-physics'),{recursive:true});copyFileSync(metadata[1],join(native,'packages/barocss-physics/package.json'));
 put('native.tsconfig.json',{compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,skipLibCheck:true,noEmitOnError:true,declaration:true,rootDir:root,outDir:native,types:['node'],typeRoots:[join(root,'node_modules/@types')]},files:[join(home,'arithmetic-opt08.test.mts')]});
 command('strict-native',[tsc,'-p',join(out,'native.tsconfig.json'),'--pretty','false','--listFiles']);
 receipt.stage='source-bundle';put('progress.json',receipt);remaining();const {build}=await import(pathToFileURL(esbuild));
 const buildResult=await build({absWorkingDir:root,entryPoints:[join(home,'arithmetic-opt08.test.mts')],bundle:true,platform:'node',format:'esm',target:'node22',outfile:join(out,'source.mjs'),metafile:true,logLevel:'silent'});
 put('source-metafile.json',buildResult.metafile);for(const p of Object.keys(buildResult.metafile.inputs))assert.ok(Object.hasOwn(frozen,resolve(root,p)),'unfrozen source input '+p);
 command('source-tests',['--test',join(out,'source.mjs')]);command('native-tests',['--test',join(native,relative(root,join(home,'arithmetic-opt08.test.mjs')))]);
 verify();remaining();receipt.status='PASS_OPT08_ISOLATED_ARITHMETIC_SOURCE_AND_GENUINE_NATIVE_FIXED_TESTS';
}catch(error){receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.stage,errorClass:error.name,message:error.message};try{if(frozen)verify();}catch(e){receipt.integrityFailure=e.message;}process.exitCode=1;}
finally{clearTimeout(timer);put('result.json',receipt);}
