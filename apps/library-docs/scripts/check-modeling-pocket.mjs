// Static/type checks only; this script never executes native geometry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const app=resolve(import.meta.dirname,'..'),root=resolve(app,'../..'),pin='deced366e75be0f27a02602d7655c555d7f6167e',base='ee461c114d34c02fae513b2adff84313e3466109';
const mode=process.argv[2]??'static';assert.ok(['static','source','emitted'].includes(mode));
const hash=x=>createHash('sha256').update(x).digest('hex'),git=(ref,p)=>execFileSync('git',['show',`${ref}:${p}`],{cwd:root,maxBuffer:8*1024*1024});
const read=p=>readFileSync(resolve(root,p));
const downloadPath='apps/library-docs/docs/public/examples/modeling-pocket.ts',guidePath='apps/library-docs/docs/packages/cad/modeling.md';
const guide=read(guidePath).toString(),download=read(downloadPath).toString();
for(const term of ["withBase('/examples/modeling-pocket.ts')",'Cut an underside pocket','5632 mm³','5120 mm³','External visual gate OPEN','two model calls','no retained tessellation','topology-derived','relativeOrientation:-1','all outputs are validated','64 panels','65-panel','[x,z,-y]','part,plate,tool'])assert.ok(guide.includes(term),term);
for(const p of ['packages/barocss-cad/src/modeling.ts','packages/barocss-cad/test/modeling-box-cut-fixture.mjs'])assert.equal(hash(read(p)),hash(git(pin,p)),p);
const transfers={};for(const [name,volume,panels,bytes,sha] of [['baseline',5632,46,1145275,'757f1344db56b48a31ffadceb8d1f5fd2b3b2eeb5bfe01ac160b3f7786f723b5'],['window',5120,32,509221,'ec4521693b44e402803debf9e73600c40fe07fdbf05dd8cdb23dad762dfc1a66']]){
 const b=read(`packages/barocss-cad-editor/scripts/fixtures/modeling-pocket/${name}-native.json`),data=JSON.parse(b),native=data.bodies.part.native;
 assert.equal(b.length,bytes);assert.equal(hash(b),sha);assert.equal(native.report.volumeMM3,volume);assert.equal(native.panels.length,panels);assert.equal(native.report.operation,'difference');
 assert.deepEqual(Object.keys(JSON.parse(data.text).outputs),['part','plate','tool']);assert.ok(Object.is(JSON.parse(data.text).nodes[0].min[0],-0));
 assert.equal(Boolean(data.buffers),name==='baseline');if(data.buffers){assert.equal(data.buffers.report.tessellateSurfaceCalls,46);assert.equal(data.buffers.positions.length,552);assert.equal(data.buffers.indices.length,276);}
 transfers[name]={bytes,sha256:sha,volumeMM3:volume,panels,retainedTessellation:name==='baseline'};
}
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(directory,e.name)):/\.(ts|json|cad\.css)$/.test(e.name)?[join(directory,e.name)]:[]);
const downloads=files(resolve(app,'docs/public/examples')).map(p=>p.slice(root.length+1));assert.equal(downloads.length,24);
const preservedDownloads=downloads.filter(p=>p!==downloadPath).map(path=>{const sha256=hash(read(path));assert.equal(sha256,hash(git(base,path)),path);return{path,sha256};});assert.equal(preservedDownloads.length,23);
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json')),ts=require('typescript');
for(const statement of ts.createSourceFile(downloadPath,download,ts.ScriptTarget.ESNext,true).statements)assert.ok(ts.isImportDeclaration(statement)||ts.isFunctionDeclaration(statement),'inert import');
let entry,typedExampleFiles=0;
if(mode!=='static'){
 entry=mode==='source'?resolve(root,'packages/barocss-cad/src/index.ts'):resolve(process.env.CAD_DECL_ROOT??resolve(root,'packages/barocss-cad/dist'),'index.d.ts');
 const provider=JSON.parse(git(pin,'packages/barocss-cad/test/modeling-box-cut-evidence/verification.json'));
 if(mode==='emitted')for(const [p,sha] of Object.entries(provider.emittedDeclarationHashes))assert.equal(hash(readFileSync(resolve(entry,'..',p.replace(/^dist\//,'')))),sha,p);
 const examples=[resolve(app,'scripts/snippets/modeling-api.ts'),...downloads.filter(p=>/\/modeling-.*\.ts$/.test(p)).map(p=>resolve(root,p))];typedExampleFiles=examples.length;assert.equal(typedExampleFiles,12);
 const dir=mkdtempSync(join(tmpdir(),'cad-pocket-types-'));try{const config=join(dir,'tsconfig.json');writeFileSync(config,JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:true,types:[],paths:{'@barocss/cad':[entry]}},files:examples}));execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',config],{stdio:'inherit'});}finally{rmSync(dir,{recursive:true,force:true});}
}
console.log(JSON.stringify({ok:true,mode,providerPin:pin,base,typedExampleFiles,guideSHA256:hash(guide),downloadSHA256:hash(download),transfers,preservedDownloads,totalDownloads:24,nativeCalls:0,externalVisualGate:'OPEN',scope:'new reconstruction static/type checks; original consumer acceptance is historical only'},null,2));
