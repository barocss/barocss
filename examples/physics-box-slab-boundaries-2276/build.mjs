/** Root-owned reproducible package/Source/strict consumer build. No World calls. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),pkg=resolve(root,'packages/barocss-physics');
const id=process.argv[2];assert(/^[a-z0-9-]+$/.test(id??''));assert(process.versions.node.startsWith('22.'));
mkdirSync(resolve(home,'build'),{recursive:true});const out=resolve(home,'build',id);mkdirSync(out,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex');
const pin=p=>{const b=readFileSync(p);return {bytes:b.length,sha256:hash(b)};};
const json=(name,data)=>writeFileSync(resolve(out,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const tree=d=>readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?tree(resolve(d,x.name)):[resolve(d,x.name)]);
const commands=[];let failure=null;
const run=(label,args,cwd=pkg)=>{
 const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:150000,maxBuffer:2*1024*1024});
 writeFileSync(resolve(out,label+'.stdout'),r.stdout??'',{flag:'wx'});writeFileSync(resolve(out,label+'.stderr'),r.stderr??'',{flag:'wx'});
 commands.push({label,executable:process.execPath,args,cwd,exit:r.status,signal:r.signal,error:r.error?.message??null});
 assert.equal(r.status,0,label+': '+(r.error?.message??r.stderr));
};
try{
 const typeRoots=[realpathSync(resolve(root,'node_modules/@types'))];
 const compiler={target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],strict:true,skipLibCheck:true,types:['node'],typeRoots,noEmitOnError:true};
 json('source-before.json',Object.fromEntries(tree(resolve(pkg,'src')).map(p=>[relative(root,p),pin(p)])));
 json('runtime.tsconfig.json',{compilerOptions:{...compiler,declaration:true,rootDir:resolve(pkg,'src'),outDir:resolve(pkg,'dist')},files:[resolve(pkg,'src/index.ts'),resolve(pkg,'src/replay.ts')]});
 run('generate',['src/generate-provider.mjs']);
 run('compile',[realpathSync(resolve(root,'node_modules/typescript/bin/tsc')),'-p',resolve(out,'runtime.tsconfig.json'),'--listFiles'],root);
 run('canonical-root',['build-root.mjs']);
 run('emitted-manifest',['src/generate-provider.mjs','--emitted']);
 const entry=resolve(out,'source-entry.ts');
 writeFileSync(entry,`export * from ${JSON.stringify(resolve(pkg,'src/index.ts'))};\nexport * from ${JSON.stringify(resolve(pkg,'src/replay.ts'))};\n`,{flag:'wx'});
 const r=await build({entryPoints:[entry],outfile:resolve(out,'source.mjs'),bundle:true,platform:'node',format:'esm',target:'es2022',metafile:true,logLevel:'silent'});
 for(const input of Object.keys(r.metafile.inputs)){
  const p=realpathSync(resolve(root,input));assert(p===entry||p.startsWith(realpathSync(resolve(pkg,'src'))+'/'),'Source dependency escaped owned Physics');
 }
 json('source-meta.json',r.metafile);
 const consumer=resolve(out,'consumer.mts');
 writeFileSync(consumer,`import {createPhysicsWorld,type PhysicsModel,type WorldOptions} from ${JSON.stringify(resolve(pkg,'dist/index.js'))};\nimport {createPhysicsRecorder,restorePhysicsRecording} from ${JSON.stringify(resolve(pkg,'dist/replay.js'))};\ndeclare const m:PhysicsModel;declare const o:WorldOptions;const w=createPhysicsWorld(m,o);const r=createPhysicsRecorder(w);const s=r.step([]);restorePhysicsRecording(r.saveRecording(),{model:m,options:o,providerDigest:s.identity.providerDigest});\n// @ts-expect-error fixed time ownership\nw.step(1/120);\n// @ts-expect-error retired domain factories have no compatibility route\nimport {createClothWorld} from ${JSON.stringify(resolve(pkg,'dist/index.js'))};\n`,{flag:'wx'});
 json('consumer.tsconfig.json',{compilerOptions:{...compiler,noEmit:true},files:[consumer]});
 run('consumer',[realpathSync(resolve(root,'node_modules/typescript/bin/tsc')),'-p',resolve(out,'consumer.tsconfig.json'),'--listFiles'],root);
 json('provider-pins.json',Object.fromEntries([...tree(resolve(pkg,'src')),...tree(resolve(pkg,'dist')),resolve(out,'source.mjs')].map(p=>[relative(root,p),pin(p)])));
}catch(error){failure={name:error.name,message:error.message,stack:error.stack};}
json('result.json',{status:failure?'BUILD_NO_GO':'PASS_BUILD',commands,firstFailure:failure,WorldCalls:0,sourceBundle:failure?null:pin(resolve(out,'source.mjs'))});
console.log(JSON.stringify({status:failure?'BUILD_NO_GO':'PASS_BUILD',commands:commands.map(x=>({label:x.label,exit:x.exit})),firstFailure:failure}));if(failure)process.exitCode=1;
