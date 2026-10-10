import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { families,publishedResolver } from '../workspace-source/probe.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),output=resolve(process.argv[2]??'/tmp/physics-1062-browser');
const nodeFolders={source:resolve(process.argv[3]),compiled:resolve(process.argv[4])};
const tool=process.argv[5]??'/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const metadata={gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),nodeVersion:process.version};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundles={},resolution={},nodeReports={};
for(const mode of ['source','compiled']){
 nodeReports[mode]=JSON.parse(await readFile(resolve(nodeFolders[mode],'report.json'),'utf8'));assert.equal(nodeReports[mode].candidateGO,true);
 const published=mode==='compiled'?await publishedResolver():null;
 const bundle=await build({absWorkingDir:root,entryPoints:[resolve(here,'browser-entry.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,...(published?{plugins:[published.plugin]}:{})});
 const own=Object.keys(bundle.metafile.inputs).map(p=>resolve(root,p)).filter(p=>families.some(f=>p.startsWith(f.directory+'/'))),src=own.filter(p=>p.includes('/src/')),dist=own.filter(p=>p.includes('/dist/'));
 assert.ok(own.length>0);assert.equal(mode==='source'?dist.length:src.length,0);
 bundles['/'+mode+'.bundle.mjs']=bundle.outputFiles[0].contents;resolution[mode]={sourceFiles:src.length,compiledFiles:dist.length,ownInputs:own,...(published?{publishedResolutions:published.resolutions}:{})};
}
const html=await readFile(resolve(here,'browser.html'));
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const bytes=path==='/browser.html'?html:bundles[path];if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':path.endsWith('.html')?'text/html':'text/javascript','cache-control':'no-store'});res.end(bytes);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const {chromium}=await import(tool);let browser;
try{
 browser=await chromium.launch({headless:true,channel:'chrome'});await mkdir(output,{recursive:true});
 for(const mode of ['source','compiled']){
  const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  const url='http://127.0.0.1:'+server.address().port+'/browser.html?mode='+mode;await page.goto(url);await page.waitForFunction(()=>window.referenceReady===true);
  const result=await page.evaluate(()=>window.runReference()),folder=resolve(output,mode);await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,'public-cases.png'),fullPage:true});
  const inputs=Buffer.from(result.inputHex,'hex'),outputs=Buffer.from(result.outputHex,'hex');
  const exactNodeBits=inputs.equals(await readFile(resolve(nodeFolders[mode],'inputs.f64.bin')))&&outputs.equals(await readFile(resolve(nodeFolders[mode],'outputs.f64.bin')));
  const exactNodeObservations=JSON.stringify(result.first)===JSON.stringify(nodeReports[mode].first);
  const {inputHex,outputHex,...data}=result,passed=result.passed&&exactNodeBits&&exactNodeObservations&&errors.length===0&&warnings.length===0;
  for(const [file,bytes]of[['inputs.f64.bin',inputs],['outputs.f64.bin',outputs]])await writeFile(resolve(folder,file),bytes);
  const report={...metadata,mode,browserVersion:browser.version(),url,...data,passed,exactNodeBits,exactNodeObservations,resolution:resolution[mode],nodeComparedHead:nodeReports[mode].gitHead,errors,warnings};
  await writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
  const nodeManifest=JSON.parse(await readFile(resolve(nodeFolders[mode],'manifest.json'),'utf8'));await writeFile(resolve(folder,'manifest.json'),JSON.stringify({...metadata,format:'capsule-sweep-raw-v1',endianness:'little',files:nodeManifest.files.map(f=>({...f,sha256:hash(f.file.startsWith('inputs')?inputs:outputs)})),totalRawBytes:inputs.length+outputs.length},null,2)+'\n');
  console.log(JSON.stringify({...metadata,mode,browserVersion:browser.version(),passed,exactNodeBits,exactNodeObservations,errors,warnings,clockMinimumPositiveMs:result.clockMinimumPositiveMs,maxP95Ms:Math.max(...result.timing.trials.flat().map(t=>t.p95Ms)),resolution:{sourceFiles:resolution[mode].sourceFiles,compiledFiles:resolution[mode].compiledFiles}}));
  await page.close();if(!passed){process.exitCode=1;break;}
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
