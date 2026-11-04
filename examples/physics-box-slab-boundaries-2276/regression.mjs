/** Unchanged thin-box assertions, native World, bundled CAD data admission. */
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];
assert(/^[a-z0-9-]+$/.test(id??''));const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});
const entry=resolve(root,'examples/physics-scene/thin-box-ccd-probe.mjs'),native=resolve(root,'packages/barocss-physics/dist/index.js');
const original=readFileSync(entry,'utf8');assert.equal(original.split('import.meta.url').length,2);
const effective=original.replace('import.meta.url',JSON.stringify(pathToFileURL(entry).href));
const hash=b=>createHash('sha256').update(b).digest('hex');
writeFileSync(resolve(out,'original.mjs'),original,{flag:'wx'});writeFileSync(resolve(out,'effective.mjs'),effective,{flag:'wx'});
const output=resolve(out,'probe.mjs'),r=await build({entryPoints:[entry],outfile:output,bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'silent',plugins:[{name:'native-world-and-relocated-data-url',setup(api){
 api.onResolve({filter:/^@barocss\/physics$/},()=>({path:native,external:true}));
 api.onResolve({filter:/index\.js$/},args=>resolve(args.resolveDir,args.path)===native?{path:native,external:true}:undefined);
 api.onLoad({filter:/thin-box-ccd-probe\.mjs$/},args=>{assert.equal(args.path,entry);return {contents:effective,loader:'js',resolveDir:dirname(entry)};});
}}]});
assert(!Object.keys(r.metafile.inputs).some(p=>p.endsWith('barocss-physics/src/world.ts')||p.endsWith('barocss-physics/dist/index.js')),'Native World must not be bundled');
const pin={originalSha256:hash(original),effectiveSha256:hash(effective),transformation:'Only import.meta.url replaced with original source URL; numerical assertions unchanged',nativeEntry:native,nativeSha256:hash(readFileSync(native)),cadAdmission:'Bundled existing CAD source/data only; no product mutation',WorldCallsBeforeImport:0};
writeFileSync(resolve(out,'provider.json'),JSON.stringify(pin,null,2)+'\n',{flag:'wx'});writeFileSync(resolve(out,'metafile.json'),JSON.stringify(r.metafile,null,2)+'\n',{flag:'wx'});
try{await import(pathToFileURL(output));writeFileSync(resolve(out,'result.json'),JSON.stringify({status:'PASS_ORIGINAL_THIN_BOX_ASSERTIONS_NATIVE_WORLD',...pin},null,2)+'\n',{flag:'wx'});}catch(error){writeFileSync(resolve(out,'result.json'),JSON.stringify({status:'REGRESSION_NO_GO',error:{name:error.name,message:error.message,stack:error.stack},...pin},null,2)+'\n',{flag:'wx'});throw error;}
