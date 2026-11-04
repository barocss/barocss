// Finite source overlays in external shadow bundles. No product source files are rewritten.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),repo=realpathSync(resolve(root,'../..'));
const targets={
 cad:realpathSync(join(repo,'packages/barocss-cad/src/api/core.ts')),
 model:realpathSync(join(root,'src/api/core.ts')),
 producer:realpathSync(join(root,'src/engine/evaluate.ts')),
 wire:realpathSync(join(root,'src/engine/nativeMassWire.ts')),
};
const original=new Map(Object.values(targets).map(path=>[path,readFileSync(path,'utf8')]));
const change=(target,from,to)=>{const source=original.get(target);if(source.split(from).length!==2)throw new Error(`Expected one mutation site: ${from}`);return{target,contents:source.replace(from,to)};};
const cadBasis="    ...(m.method === 'tessellated' ? { volumeBasis: { method: 'tessellated' as const, bound: m.volumeBound ?? null } } : {}),";
const modelBasis='    ...(body.volumeBasis ? { volumeBasis: { ...body.volumeBasis } } : {})';
const variants=[
 ['baseline',{target:targets.model,contents:original.get(targets.model)}],
 ['cad-method-drop',change(targets.cad,'method: m.method,','')],
 ['cad-basis-drop',change(targets.cad,cadBasis,'')],
 ['model-method-drop',change(targets.model,'    ...(body.massMethod !== undefined ? { method: body.massMethod } : {}),','')],
 ['model-basis-drop',change(targets.model,modelBasis,'')],
 ['producer-method-drop',change(targets.producer,'massMethod: m.method, ','')],
 ['producer-method-constant',change(targets.producer,'massMethod: m.method,',"massMethod: 'closed-form',")],
 ['deferred-method-drop',change(targets.producer,'  return o ? placedMassFields(massFields(massOfBrep(o)), place) : undefined;', '  const fields = o ? placedMassFields(massFields(massOfBrep(o)), place) : undefined; if (fields) delete fields.massMethod; return fields;')],
 ['signature-method-omit',change(targets.wire,', body.massMethod ?? null','')],
 ['method-allowlist-drop',change(targets.wire,"  if (body.massMethod !== undefined && !['closed-form', 'planar-exact', 'quadrature', 'tessellated'].includes(body.massMethod)) return false;",'')],
 ['estimate-density-scale',change(targets.model,modelBasis,'    ...(body.volumeBasis ? { volumeBasis: { ...body.volumeBasis, bound: body.volumeBasis.bound === null ? null : body.volumeBasis.bound * density } } : {})')],
 ['estimate-alias',change(targets.model,modelBasis,'    ...(body.volumeBasis ? { volumeBasis: body.volumeBasis } : {})')],
];
const evidence=process.argv[2]?realpathSync(process.argv[2]):null;
if(evidence&&(evidence===repo||evidence.startsWith(`${repo}/`)))throw new Error('Evidence must stay outside the worktree');
const out=realpathSync(mkdtempSync(join(tmpdir(),'mass-provenance-mutations-'))),receipts=[];
const sha=source=>createHash('sha256').update(source).digest('hex');
try{
 for(const[name,{target,contents}]of variants){
  const dir=join(out,name);mkdirSync(dir);
  const file=join(dir,'overlay.ts'),manifest=join(dir,'overlay.json'),trace=[];
  writeFileSync(file,contents);writeFileSync(manifest,JSON.stringify({source:target,file}));
  const plugin={name:'one-owned-mass-source',setup(builder){builder.onLoad({filter:/\.ts$/},args=>{
   if(realpathSync(args.path)!==target)return;
   trace.push({source:target,overlay:file});return{contents,loader:'ts',resolveDir:resolve(target,'..')};
  });}};
  const files=[
   [join(root,'test/api-mass-provenance.test.ts'),'model.mjs'],
   [join(root,'test/cad-mass-provenance.test.ts'),'cad-forced.mjs'],
   [join(repo,'apps/cad-studio/test/mass-provenance.test.ts'),'studio.mjs'],
  ];
  const outputs=[];
  for(const[entry,name]of files){const outfile=join(dir,name);outputs.push(outfile);await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'warning',define:{'import.meta.dirname':JSON.stringify(join(root,'test'))},plugins:[plugin]});}
  const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...outputs],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,BAROCSS_MASS_PROVENANCE_OVERLAY:manifest}});
  if(result.error)throw result.error;
  const output=`${result.stdout??''}${result.stderr??''}`;
  if(evidence){writeFileSync(join(evidence,`${name}.log`),output);writeFileSync(join(evidence,`${name}.source.ts`),contents);writeFileSync(join(evidence,`${name}.trace.json`),JSON.stringify(trace,null,2));}
  const count=key=>Number(new RegExp(`^# ${key} (\\d+)$`,'m').exec(output)?.[1]??NaN);
  const tests=count('tests'),passed=count('pass'),failed=count('fail'),cancelled=count('cancelled'),assertions=(output.match(/^\s+code: 'ERR_ASSERTION'$/gm)??[]).length;
  if(!trace.length||tests!==32||passed+failed!==tests||cancelled!==0||result.signal)throw new Error(`${name}: incomplete overlay/behavioral census\n${output}`);
  if(name==='baseline'){if(result.status!==0||failed!==0)throw new Error(`Baseline failed\n${output}`);}
  else if(result.status!==1||failed<1||assertions!==failed)throw new Error(`${name}: mutation not killed solely by behavioral assertions\n${output}`);
  const receipt={variant:name,result:name==='baseline'?'PASS':'KILLED',target:relative(repo,target),sourceSha256:sha(original.get(target)),overlaySha256:sha(contents),overrides:trace.length,tests,passed,failed,cancelled,assertions,exitCode:result.status};receipts.push(receipt);process.stdout.write(`${JSON.stringify(receipt)}\n`);
 }
 if(evidence)writeFileSync(join(evidence,'summary.json'),`${JSON.stringify(receipts,null,2)}\n`);
}finally{rmSync(out,{recursive:true,force:true});}
