// Root owns this runner. Caller provides the existing180s owned process guard.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,openSync,readSync,closeSync,copyFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const node='/Users/user/.volta/tools/image/node/22.19.0/bin/node';
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const EXPECTED_TESTS=32;
assert.equal(realpathSync(process.execPath),realpathSync(node));
const id=process.argv[2];assert.match(id??'',/^same32-[a-z0-9-]{1,48}$/);
const out=join(home,'evidence',id);assert.ok(!existsSync(out),'fresh result required');mkdirSync(out,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
const hash=path=>{
 const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');
 try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}
 finally{closeSync(fd);}return h.digest('hex');
};
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const put=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');
const require=createRequire(join(root,'package.json')),tsc=require.resolve('typescript/lib/tsc.js');
const esbuild=require.resolve('esbuild'),esbuildNative=createRequire(esbuild).resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild');
const fixture=join(root,'examples/physics-stack-solver-2276/evidence/fixture-01/fixture.json');
const candidate=join(root,'packages/barocss-physics/src/stack/stationary-normal.ts');
const deadline=Date.now()+170000;
const receipt={status:'RUNNING',stage:'freeze',commands:[],firstFailure:null,publicAPI:false,full1200:'NOT_RUN',bridgeAdoption:false};
let frozen;
const remaining=()=>{const n=Math.floor(deadline-Date.now());assert.ok(n>0,'inner170s deadline');return n;};
function verify(){
 const after=Object.fromEntries(Object.keys(frozen).map(p=>[p,hash(p)]));
 put('inputs-after.json',after);assert.deepEqual(after,frozen,'source or tool changed');
}
function command(stage,executable,args,env={},input){
 receipt.stage=stage;put('progress.json',receipt);
 const timeout=remaining(),result=spawnSync(executable,args,{cwd:root,encoding:'utf8',timeout,
  maxBuffer:2**21,input,env:{...process.env,NODE_DISABLE_COMPILE_CACHE:'1',...env}});
 writeFileSync(join(out,stage+'.stdout'),result.stdout??'');
 writeFileSync(join(out,stage+'.stderr'),result.stderr??'');
 receipt.commands.push({stage,executable,args,timeoutMs:timeout,exit:result.status,signal:result.signal,error:result.error?.message});
 put('progress.json',receipt);assert.equal(result.status,0,stage+' first failure');
 assert.equal(result.signal,null);assert.equal(result.error,undefined);
 return result.stdout;
}
const timer=setTimeout(()=>{
 receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.stage,message:'inner170s deadline'};
 put('result.json',receipt);process.exit(1);
},remaining());
try{
 assert.equal(hash(fixture),'da088aeff200bdcfe27927f11286e8a9f6a63f772c6f5558ae11feb2e9d769eb');
 const source=readFileSync(candidate,'utf8');
 const unit=source.replace("from './normal-solver.js'","from '../../packages/barocss-physics/src/stack/normal-solver.js'")+
  '\nexport { solveCore as unitCore, Exact as UnitExact, triangle as unitTriangle };\n';
 assert.notEqual(source,unit);assert.equal(readFileSync(join(home,'unit-source.ts'),'utf8'),unit,'whole production/test source identity');
 const owned=readdirSync(home).filter(n=>statSync(join(home,n)).isFile()).map(n=>join(home,n));
 const metadata=[join(root,'package.json'),join(root,'packages/barocss-physics/package.json')];
 const inputs=[...owned,...files(join(root,'packages/barocss-physics/src')),
  join(root,'examples/physics-stack-solver-2276/verification.ts'),fixture,...metadata,
  node,python,tsc,resolve(dirname(tsc),'_tsc.js'),esbuild,esbuildNative];
 frozen=Object.fromEntries([...new Set(inputs)].map(p=>[p,hash(p)]));put('inputs-before.json',frozen);
 // Preserve the actual first-attempt source, not only hashes, before compilation.
 for(const path of [...owned,candidate,join(root,'packages/barocss-physics/src/stack/normal-solver.ts'),
   join(root,'examples/physics-stack-solver-2276/verification.ts'),fixture,...metadata]){
  assert.ok(statSync(path).size<=2**21);const target=join(out,'frozen-source',relative(root,path));
  mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);assert.equal(hash(target),hash(path));
 }
 const native=join(out,'native-modules');mkdirSync(native);
 for(const path of metadata){const target=join(native,relative(root,path));mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);}
 put('native.tsconfig.json',{compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',
  strict:true,skipLibCheck:true,noEmitOnError:true,declaration:true,rootDir:root,outDir:native,
  types:['node'],typeRoots:[join(root,'node_modules/@types')]},files:[join(home,'controls.test.mts')]});
 command('strict-native',node,[tsc,'-p',join(out,'native.tsconfig.json'),'--pretty','false','--listFiles']);
 receipt.stage='source-bundle';put('progress.json',receipt);
 const {build}=await import(pathToFileURL(esbuild));
 const bundle=await build({absWorkingDir:root,entryPoints:[join(home,'controls.test.mts')],bundle:true,
  platform:'node',format:'esm',target:'node22',outfile:join(out,'source.mjs'),metafile:true,logLevel:'silent'});
 put('source-metafile.json',bundle.metafile);
 for(const name of Object.keys(bundle.metafile.inputs))assert.ok(Object.hasOwn(frozen,resolve(root,name)),'unfrozen bundle input');
 const outputs=[];
 for(const [name,entry]of [['source',join(out,'source.mjs')],['native',join(native,relative(root,join(home,'controls.test.mjs')))]]){
  const data=join(out,name+'-receipts.jsonl');
  const stdout=command(name+'-tests',node,['--test',entry],{STATIONARY_FIXTURE:fixture,STATIONARY_RECEIPTS:data});
  assert.match(stdout,new RegExp('# tests '+EXPECTED_TESTS+'\\b'));
  assert.match(stdout,/# fail 0\b/);assert.ok(statSync(data).size<=2**21);
  const requests=readFileSync(data,'utf8'),rows=requests.trimEnd().split('\n').map(s=>JSON.parse(s));
  assert.equal(rows.length,11);assert.equal(rows.filter(r=>r.originalVerification).length,1);
  const checked=command(name+'-fraction',python,['-B',join(home,'checker.py')],{},requests);
  const replies=checked.trimEnd().split('\n').map(s=>JSON.parse(s));assert.equal(replies.length,rows.length);
  for(const row of replies){assert.equal(row.ok,true);assert.equal(row.resolved,true);assert.equal(row.executionFailure,false);assert.deepEqual(row.violations,[]);}
  put(name+'-fraction.json',{status:'PASS_ALL_RECORDED_WITNESSES',requests:rows.length,replies});
  outputs.push({name,data,checked,rows,replies});
 }
 assert.equal(hash(outputs[0].data),hash(outputs[1].data),'all Source/Native problem/result/word/Float reports equal');
 assert.equal(outputs[0].checked,outputs[1].checked,'all independent Fraction replies equal');
 const checkerControls=String.raw`
import copy,importlib.util,json,math,struct,sys
spec=importlib.util.spec_from_file_location('independent_witness_checker',sys.argv[1])
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
rows=[json.loads(line) for line in open(sys.argv[2])]
r=next(x for x in rows if 'originalVerification' in x)
p=c.restore_words(r['problem'],r['problemWordsF64leHex'])
s=c.restore_words(r['result'],r['resultWordsF64leHex'])
assert c.verify(p,s)['ok'] is True
done=[]
assert struct.pack('>d',c.restore_words([0],'0000000000000080')[0]).hex()=='8000000000000000'
done.append('negative_zero_restored')
for name,value,raw in [('nonzero_word_mismatch_refused',[1],'0000000000000040'),
 ('trailing_word_refused',[],'0000000000000000'),
 ('nonfinite_word_refused',[0],'000000000000f07f')]:
 try:c.restore_words(value,raw)
 except ValueError:done.append(name)
 else:raise AssertionError(name)
k=next(i for i,v in enumerate(s['normalImpulsesNs']) if v>0)
dynamic=next(i for i,b in enumerate(p['bodies']) if b['inverseMass']==1)
for name in ['unreduced_ratio_refused','coefficient_word_refused','nonzero_after_velocity_refused',
 'false_certificate_refused','stats_limit_refused','changed_pose_refused']:
 bad=copy.deepcopy(s)
 if name=='unreduced_ratio_refused':
  q=bad['exactApplied']['points'][k]['lambda'];q['n']=str(2*int(q['n']));q['d']=str(2*int(q['d']))
 elif name=='coefficient_word_refused':bad['exactApplied']['points'][k]['a']['words'][0]='0000000000000001'
 elif name=='nonzero_after_velocity_refused':bad['bodies'][dynamic]['velocityMps'][0]=float.fromhex('0x0.0000000000001p-1022')
 elif name=='false_certificate_refused':bad['exactApplied']['nonnegative']=False
 elif name=='stats_limit_refused':bad['stats']['integerOperations']=2000001
 elif name=='changed_pose_refused':bad['bodies'][dynamic]['positionM'][0]=math.nextafter(bad['bodies'][dynamic]['positionM'][0],math.inf)
 assert c.verify(p,bad)['ok'] is False,name
 done.append(name)
assert len(done)==10
print(json.dumps(dict(status='PASS_CANDIDATE_FREE_CHECKER_TEN_CONTROLS',checks=done)))
`;
 const controls=command('checker-controls',python,['-B','-c',checkerControls,join(home,'checker.py'),outputs[0].data]);
 assert.equal(JSON.parse(controls).status,'PASS_CANDIDATE_FREE_CHECKER_TEN_CONTROLS');
 assert.ok(files(out).reduce((n,p)=>n+statSync(p).size,0)<=280*2**20,'shared component artifact cap');
 verify();remaining();receipt.status='PASS_STATIONARY_SAME32_SOURCE_NATIVE_FRACTION_FLOAT';
 receipt.fixedTestsPerGraph=EXPECTED_TESTS;receipt.recordedWitnessesPerGraph=outputs[0].rows.length;
 receipt.same32Independent=outputs[0].rows.find(r=>r.originalVerification).originalVerification;
 receipt.same32Fraction=outputs[0].replies[outputs[0].rows.findIndex(r=>r.originalVerification)];
 receipt.parity=true;
}catch(error){
 receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.stage,errorClass:error.name,message:error.message};
 if(frozen)try{verify();}catch(e){receipt.integrityFailure=e.message;}
 process.exitCode=1;
}finally{clearTimeout(timer);put('result.json',receipt);}
