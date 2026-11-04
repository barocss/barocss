import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),here=resolve(root,'examples/physics-tangent-response-2276/build'),pkg=resolve(root,'packages/barocss-physics');
const pins=JSON.parse(readFileSync('examples/physics-rigid-rotation-g1-2276/TOOLCHAIN-PINS-02.json')), aliases={};
for(const [path,pin] of Object.entries(pins.toolFiles)){const data=readFileSync(path);assert.equal(data.length,pin.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),pin.sha256);aliases[path]=realpathSync(path);}
const node=process.execPath,esbuild=realpathSync(pins.tools.esbuildBinary),tsc=realpathSync(pins.tools.typescriptCLI);
const result={status:'RUNNING',aliases,commands:[],node};
function run(label,cwd,exe,args,env={}){const x=spawnSync(exe,args,{cwd,env:{...process.env,...env},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});writeFileSync(resolve(here,label+'.stdout'),x.stdout??'');writeFileSync(resolve(here,label+'.stderr'),x.stderr??'');result.commands.push({label,exe,args,cwd,status:x.status,signal:x.signal,error:x.error?.message??null});assert.equal(x.status,0,label+': '+x.stderr);}
try{
run('generate',pkg,node,['src/generate-provider.mjs']);
run('compile',root,node,[tsc,'-p',resolve(here,'runtime.tsconfig.json'),'--listFiles']);
run('canonical-root',pkg,node,['build-root.mjs'],{ESBUILD_BINARY_PATH:esbuild});
run('emitted-manifest',pkg,node,['src/generate-provider.mjs','--emitted']);
run('source-bundle',root,esbuild,[resolve(here,'source-entry.ts'),'--bundle','--platform=node','--format=esm','--target=es2022','--outfile='+resolve(here,'source.mjs'),'--metafile='+resolve(here,'source-meta.json')]);
const meta=JSON.parse(readFileSync(resolve(here,'source-meta.json')));for(const input of Object.keys(meta.inputs)){const p=realpathSync(resolve(root,input));assert(p.startsWith(root+'/'));}
run('consumer',root,node,[tsc,'-p',resolve(here,'consumer.tsconfig.json'),'--listFiles']);
result.status='PASS_BUILD';
}catch(e){result.status='FAIL_BUILD';result.firstFailure={message:e.message,stack:e.stack};process.exitCode=1;}
writeFileSync(resolve(here,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,commands:result.commands.map(x=>({label:x.label,status:x.status})),firstFailure:result.firstFailure??null}));
