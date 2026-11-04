// Root-only build. Authenticates and copies an immutable already-transformed closure.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''),'fresh build ID required');
const hash=b=>createHash('sha256').update(b).digest('hex'),pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:hash(b)};};
const sourcePins=JSON.parse(readFileSync(resolve(home,'SOURCE-PINS-02.json')));assert.equal(sourcePins.format,'physics-warm-transport-source-freeze');for(const[p,v]of Object.entries(sourcePins.files))assert.deepEqual(pin(resolve(root,p)),v,'Frozen author/dependency drift '+p);
const old=resolve(root,'examples/physics-contact-wrench-producer-2276/evidence/build-01'),receipt=JSON.parse(readFileSync(resolve(old,'result.json')));assert.equal(receipt.status,'PASS_PRIVATE_PHASE_BUILD');assert.equal(receipt.WorldCalls,0);assert.deepEqual(pin(resolve(old,'source.mjs')),receipt.source);
const tree=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>{assert(!e.isSymbolicLink(),'No stage symlinks');return e.isDirectory()?tree(resolve(p,e.name)):[resolve(p,e.name)];});
const inventory=p=>Object.fromEntries(tree(p).map(f=>[relative(p,f),pin(f)]));assert.deepEqual(inventory(resolve(old,'stage')),receipt.staged,'Complete qualified closure inventory');
const out=resolve(home,'evidence',id),stage=resolve(out,'stage'),src=resolve(stage,'physics/src');mkdirSync(out);cpSync(resolve(old,'stage'),stage,{recursive:true});assert.deepEqual(inventory(stage),receipt.staged,'Copied qualified closure before warm-only delta');
function edit(name,patch){const p=resolve(src,name);writeFileSync(p,patch(readFileSync(p,'utf8')));}
function once(s,a,b){assert.equal(s.split(a).length-1,1,'Unique warm patch anchor');return s.replace(a,b);}
// Import only after all source pins and original closure bytes are authenticated.
const {warmTransportTransform}=await import(pathToFileURL(resolve(home,'stage-patch.mjs')));warmTransportTransform({src,edit,once});
writeFileSync(resolve(stage,'entry.ts'),readFileSync(resolve(stage,'entry.ts'),'utf8')+"export {transportWarmTangent,WarmTransportError} from './physics/src/warm-transport.js';\n");
const priorManifest=resolve(src,'provider-manifest.generated.ts');const identityFiles=Object.fromEntries(tree(stage).filter(p=>p!==priorManifest).map(p=>[relative(stage,p),pin(p)]));
const manifest={format:'barocss-physics-private-phase-provider',version:1,graph:'SOURCE_PRIVATE_WARM_TRANSPORT_01',ancestor:{result:pin(resolve(old,'result.json')),source:receipt.source,manifest:receipt.manifest},files:identityFiles,deltas:['orthogonal Gram-equivalent nested-cross tangent projection immediately before warm apply','private helper test export'],law:'ONLY_WARM_TANGENT_TRANSPORT_DELTA_8_OUTER_8_INNER_UNCHANGED'};
writeFileSync(priorManifest,'export const providerManifest = '+JSON.stringify(manifest,null,2)+' as const;\n');
const staged=inventory(stage);for(const[p,v]of Object.entries(receipt.staged))if(!['physics/src/persistent-box-contact.ts','physics/src/provider-manifest.generated.ts','entry.ts'].includes(p))assert.deepEqual(staged[p],v,'Unchanged qualified stage file '+p);
const {build}=await import('esbuild');const result=await build({entryPoints:[resolve(stage,'entry.ts')],outfile:resolve(out,'source.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'silent',absWorkingDir:root});for(const p of Object.keys(result.metafile.inputs))assert(realpathSync(resolve(root,p)).startsWith(stage+'/'),'Source graph escaped staged closure');
assert.notEqual(pin(resolve(out,'source.mjs')).sha256,receipt.source.sha256,'Distinct provider bundle required');
const put=(n,v)=>writeFileSync(resolve(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});put('metafile.json',result.metafile);put('result.json',{status:'PASS_PRIVATE_WARM_TRANSPORT_BUILD',WorldCalls:0,candidateCalls:0,currentHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourcePins:pin(resolve(home,'SOURCE-PINS-02.json')),own:sourcePins.files,ancestorResult:pin(resolve(old,'result.json')),ancestorSource:receipt.source,manifest,staged,source:pin(resolve(out,'source.mjs'))});console.log(JSON.stringify({status:'PASS_PRIVATE_WARM_TRANSPORT_BUILD',WorldCalls:0,candidateCalls:0,stagedFiles:Object.keys(staged).length}));
