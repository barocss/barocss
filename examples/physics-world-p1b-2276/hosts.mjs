import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const generated=spawnSync(process.execPath,['packages/barocss-physics/src/generate-provider.mjs'],{cwd:root,encoding:'utf8',timeout:180000});
if(generated.status!==0)throw Error(generated.stderr);
const entries=['physics-scene/app.js','physics-cad-scene/app.js',...['app','joint-demo','motor-demo','dynamic-hinge-demo','offset-hinge-demo'].map(n=>`physics-viewer-scene/${n}.js`)];
for(const entry of entries){
 const result=await build({entryPoints:[resolve(root,'examples',entry)],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logLevel:'silent',external:['../../packages/barocss-viewer/dist/index.js'],plugins:[{name:'own-cad-source',setup(api){api.onResolve({filter:/^@barocss\/cad(?:\/.*)?$/},args=>{const pkg=resolve(root,'packages/barocss-cad');const m=JSON.parse(readFileSync(resolve(pkg,'package.json')));const key=args.path==='@barocss/cad'?'.':'.'+args.path.slice('@barocss/cad'.length);return{path:resolve(pkg,m.exports[key].import)};});}}]});
 const physicsInputs=Object.keys(result.metafile.inputs).filter(path=>path.includes('packages/barocss-physics/')).map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}));
 const externalImports=Object.values(result.metafile.outputs).flatMap(output=>output.imports.filter(item=>item.external).map(item=>item.path));
 console.log(JSON.stringify({entry,bytes:result.outputFiles[0].contents.length,inputs:Object.keys(result.metafile.inputs).length,physicsInputs,externalImports,execution:'NOT_RUN',kind:'current-host-callsite-bundle',viewerSDK:'explicit external rendering boundary; dist absent; NOT_BUILT'}));
}
