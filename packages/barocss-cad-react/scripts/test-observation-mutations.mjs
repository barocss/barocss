/** Serial external source overlays. No checkout/source-tree edits, new dependencies or GPU execution. */
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),repo=realpathSync(resolve(root,'../..'));
const host=realpathSync(join(root,'src/model-host.ts')),viewer=realpathSync(join(root,'src/viewer.ts'));
const sources=new Map([host,viewer].map(path=>[path,readFileSync(path,'utf8')]));
const change=(target,from,to)=>{
 const original=sources.get(target);if(original.split(from).length!==2)throw new Error(`Expected exactly one mutation site: ${from}`);
 return{target,contents:original.replace(from,to)};
};
const variants=[
 ['baseline',{target:host,contents:sources.get(host)}],
 ['document-alias',change(host,'currentDocument: this.desired ? structuredClone(this.desired.doc) : null','currentDocument: this.desired?.doc ?? null')],
 ['submitted-array-alias',change(host,'submitted: this.submitted.map(entry => ({ ...entry }))','submitted: this.submitted')],
 ['submitted-entry-alias',change(host,'submitted: this.submitted.map(entry => ({ ...entry }))','submitted: this.submitted.map(entry => entry)')],
 ['centroid-alias',change(host,'centroid: body.centroid ? [...body.centroid] as [number, number, number] : null','centroid: body.centroid ?? null')],
 ['bounds-min-alias',change(host,'[...body.mesh.bounds.min] as [number, number, number]','body.mesh.bounds.min')],
 ['bounds-max-alias',change(host,'[...body.mesh.bounds.max] as [number, number, number]','body.mesh.bounds.max')],
 ['adapter-state-alias',change(host,'adapter: this.state ? { ...this.state } : null','adapter: this.state')],
 ['pixel-diagnostics-alias',change(viewer,'pixels: this.pixels ? { ...this.pixels } : null','pixels: this.pixels')],
];
const evidence=process.argv[2]?realpathSync(process.argv[2]):null;
if(evidence&&(evidence===repo||evidence.startsWith(`${repo}/`)))throw new Error('Evidence must stay outside the worktree');
const out=realpathSync(mkdtempSync(join(tmpdir(),'cad-react-observation-mutations-'))),receipts=[];
const sha256=text=>createHash('sha256').update(text).digest('hex');
try{
 for(const[name,{target,contents}]of variants){
  const file=join(out,`${name}.ts`),manifest=join(out,`${name}.json`),trace=join(out,`${name}.trace.jsonl`);
  writeFileSync(file,contents);writeFileSync(manifest,JSON.stringify({source:target,file}));
  const result=spawnSync(process.execPath,['--test','tests/observation-ownership.test.mjs'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,BAROCSS_CAD_REACT_TEST_SOURCE_OVERLAY:manifest,BAROCSS_CAD_REACT_TEST_SOURCE_OVERLAY_TRACE:trace}});
  if(result.error)throw result.error;
  const output=`${result.stdout??''}${result.stderr??''}`;let traceText='';
  try{traceText=readFileSync(trace,'utf8');}catch(error){if(evidence)writeFileSync(join(evidence,`${name}.trace-error.log`),String(error));}
  // Retain raw output and traces before parsing/validating them, including failed harness attempts.
  if(evidence){writeFileSync(join(evidence,`${name}.log`),output);writeFileSync(join(evidence,`${name}.source.ts`),contents);writeFileSync(join(evidence,`${name}.trace.jsonl`),traceText);}
  const traces=traceText.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  if(!traces.length||traces.some(item=>item.source!==target||item.file!==file))throw new Error(`${name}: unexpected source overlay receipt ${JSON.stringify({expected:{source:target,file},actual:traces})}`);
  const count=key=>Number(new RegExp(`^# ${key} (\\d+)$`,'m').exec(output)?.[1]??NaN);
  const tests=count('tests'),passed=count('pass'),failed=count('fail'),cancelled=count('cancelled');
  const assertions=(output.match(/^\s+code: 'ERR_ASSERTION'$/gm)??[]).length;
  if(tests!==13||passed+failed!==tests||cancelled!==0||result.signal)throw new Error(`${name}: incomplete behavioral census\n${output}`);
  if(name==='baseline'){
   if(result.status!==0||failed!==0)throw new Error(`Behavioral baseline failed\n${output}`);
  }else if(result.status!==1||failed<1||assertions!==failed)throw new Error(`${name}: every mutant failure must be an executed behavioral assertion\n${output}`);
  const receipt={variant:name,result:name==='baseline'?'PASS':'KILLED',target:relative(repo,target),sourceSha256:sha256(sources.get(target)),overlaySha256:sha256(contents),overrides:traces.length,tests,passed,failed,cancelled,assertions,exitCode:result.status};
  receipts.push(receipt);process.stdout.write(`${JSON.stringify(receipt)}\n`);
 }
 if(evidence)writeFileSync(join(evidence,'summary.json'),`${JSON.stringify(receipts,null,2)}\n`);
}finally{rmSync(out,{recursive:true,force:true});}
