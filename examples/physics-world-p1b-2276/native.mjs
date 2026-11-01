// Local installed-artifact proof; no package manager, network or publication.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const id=process.argv[2];
if (!/^[a-z0-9-]+$/.test(id??'') || process.argv.length!==3 || !process.versions.node.startsWith('22.')) throw Error('Node22 native.mjs <fresh-id>');
const dir=join(here,'evidence',id), stage=join(dir,'stage');
if(existsSync(dir)) throw Error('receipt already exists');
mkdirSync(stage,{recursive:true});
const hash=x=>createHash('sha256').update(x).digest('hex'), records=[];
for(const name of ['physics','cad']) {
  const source=join(root,'packages',`barocss-${name}`), target=join(stage,'node_modules/@barocss',name);
  mkdirSync(target,{recursive:true});
  const manifest=JSON.parse(readFileSync(join(source,'package.json')));
  for(const key of ['main','types','exports']) manifest[key]=manifest.publishConfig[key];
  writeFileSync(join(target,'package.json'),JSON.stringify(manifest,null,2));
  cpSync(join(source,'dist'),join(target,'dist'),{recursive:true});
}
function inventory(path) { for(const e of readdirSync(path,{withFileTypes:true})) {const p=join(path,e.name);if(e.isDirectory())inventory(p);else records.push({path:relative(stage,p),sha256:hash(readFileSync(p))});} }
inventory(join(stage,'node_modules'));
writeFileSync(join(dir,'artifact-hashes.json'),JSON.stringify(records,null,2)+'\n');
cpSync(join(root,'examples/physics-scene/release-consumer.mjs'),join(stage,'consumer.mjs'));
cpSync(join(root,'examples/physics-cad-scene/two-surfaces.barocad'),join(stage,'two-surfaces.barocad'));
writeFileSync(join(stage,'consumer.mts'),`import {createPhysicsWorld, type PhysicsModel, type WorldOptions} from '@barocss/physics';
import {createPhysicsScene,createPhysicsReplaySession,serializePhysicsSnapshot,deserializePhysicsSnapshot} from '@barocss/physics/replay';
import {admitCadSurfaceProxy} from '@barocss/physics/cad-proxy';
// @ts-expect-error removed creation type
import type {PhysicsWorldConfig} from '@barocss/physics';
// @ts-expect-error independent reduced reference is not root API
import {createPlanarPendulum} from '@barocss/physics';
declare const model:PhysicsModel, options:WorldOptions;
const world=createPhysicsWorld(model,options);
world.step([]);world.getModel();world.getState();
world.query({kind:'raycast',originM:[0,0,0],direction:[1,0,0],maxDistanceM:1,includeSensors:false});
// @ts-expect-error removed flat constructor
createPhysicsWorld({bodies:[]});
// @ts-expect-error fixed step is options data, not command
world.step(1/120);
// @ts-expect-error use tagged query
world.raycast({});
// @ts-expect-error old state rotation field removed
world.getState().bodies[0].orientation;
const scene=createPhysicsScene(model,options,{revision:'compile1',sourceRevision:'compile1'});
const replay=createPhysicsReplaySession(scene);
const bytes:Uint8Array=serializePhysicsSnapshot(replay.saveSnapshot());
deserializePhysicsSnapshot(bytes);void admitCadSurfaceProxy;
`);
const readmeBlocks=[...readFileSync(join(root,'packages/barocss-physics/README.md'),'utf8').matchAll(/```ts\n([\s\S]*?)```/g)].map(match=>match[1]);
readmeBlocks.forEach((contents,index)=>writeFileSync(join(stage,`readme-${index}.mts`),contents));
writeFileSync(join(stage,'readme-tsconfig.json'),JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,skipLibCheck:false,types:[],outDir:'compiled-readme'},files:readmeBlocks.map((_,index)=>`readme-${index}.mts`)}));
writeFileSync(join(stage,'tsconfig.json'),JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',strict:true,noEmit:true,skipLibCheck:false,types:[]},files:['consumer.mts']}));
const runs=[];
function run(label,args,cwd=stage) {
 const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 writeFileSync(join(dir,label+'.stdout.txt'),r.stdout??'');writeFileSync(join(dir,label+'.stderr.txt'),r.stderr??'');
 runs.push({label,command:[process.execPath,...args],cwd,exit:r.status,signal:r.signal,error:r.error?.message??null});
 writeFileSync(join(dir,'result.json'),JSON.stringify({utc:new Date().toISOString(),runs,publication:false,installedArtifacts:records.length},null,2)+'\n');
 if(r.status!==0) {process.exitCode=1;return false;}return true;
}
if(run('native-runtime',['consumer.mjs']) && run('native-types',[join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json']) && run('readme-types',[join(root,'node_modules/typescript/bin/tsc'),'-p','readme-tsconfig.json'])) {
 for(let index=0;index<readmeBlocks.length;index++) if(!run(`readme-runtime-${index}`,[`compiled-readme/readme-${index}.mjs`]))break;
}
console.log(JSON.stringify({runs:runs.map(({label,exit})=>({label,exit})),artifacts:records.length}));
