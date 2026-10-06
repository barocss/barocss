// Capture the actual committed baseline UI with its own built engines; no substitute image.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(head,process.argv[4],'Baseline checkout must match declared committed SHA');
assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','Baseline must be clean');
assert(process.env.PW_DIR && process.env.CHROME,'Installed browser/runtime paths required');
const require=createRequire(path.join(process.env.PW_DIR,'package.json'));
const {chromium}=require('playwright');
const {startServer}=await import(pathToFileURL(path.join(root,'examples/cad-preview/server.mjs')).href);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=await startServer();const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir(output,{recursive:true});
try {
 const records=[];
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).origin!==server.url)requests.push(request.url());});
  await page.goto(server.url);await page.waitForFunction(()=>window.cadPreview?.snapshot()?.packet);
  const native=await page.evaluate(()=>{const host=window.cadPreview,gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{snapshot:host.snapshot(),backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,bytes:Array.from(host.readPixels())};});
  assert(/SwiftShader/.test(native.backend));assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const filename=`${name}-before.png`;await page.screenshot({path:path.join(output,filename),fullPage:true,animations:'disabled'});
  records.push({name,viewport:{width,height},head,filename,sha256:hash(await readFile(path.join(output,filename))),backend:native.backend,actualRenderedGeometry:true,sourceHash:hash(native.snapshot.source),nativeHash:hash(JSON.stringify(native.snapshot.model)),readbackHash:hash(Uint8Array.from(native.bytes))});await page.close();
 }
 const packageModules={},sourceModules={};
 for(const pkg of ['barocss-cad','barocss-gpu'])for(const name of await readdir(path.join(root,'packages',pkg,'dist')))if(name.endsWith('.js')){const file=`packages/${pkg}/dist/${name}`;packageModules[file]=hash(await readFile(path.join(root,file)));}
 for(const file of execFileSync('git',['ls-files','examples/cad-preview'],{cwd:root,encoding:'utf8'}).trim().split('\n'))sourceModules[file]=hash(await readFile(path.join(root,file)));
 await writeFile(path.join(output,'index.json'),JSON.stringify({head,records,packageModules,sourceModules,limitations:['Actual UI screenshots using software WebGL2; not physical GPU or performance evidence']},null,2)+'\n');
 console.log(`Committed baseline screenshots: ${output}`);
}finally{await browser.close();await server.close();}
