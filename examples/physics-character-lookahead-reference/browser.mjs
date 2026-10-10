import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {families} from '../workspace-source/probe.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),output=resolve(process.argv[2]??'/tmp/physics-character-lookahead-browser');
// Import optional verification tooling BEFORE binding a server.
const runtime=process.argv[3]??process.env.CHARACTER_PLAYWRIGHT_PATH;
const {chromium}=await import(runtime?pathToFileURL(resolve(runtime)).href:'playwright');
await mkdir(output,{recursive:true});
const metadata={modelId:'same-ray-lookahead-v1',lookaheadM:.02,gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()};
const bundle=await build({absWorkingDir:root,entryPoints:[resolve(here,'browser-entry.mjs')],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',metafile:true});
const own=Object.keys(bundle.metafile.inputs).map(p=>resolve(root,p)).filter(p=>families.some(f=>p.startsWith(f.directory+'/')));
const source=own.filter(p=>p.includes('/src/')),dist=own.filter(p=>p.includes('/dist/'));
if(!source.length||dist.length)throw new Error('Ordinary actual public source browser graph required');
const html='<!doctype html><meta charset="utf-8"><title>Character movement numerical reference</title><style>body{font:16px system-ui;margin:32px}table{border-collapse:collapse}td,th{text-align:left;padding:10px;border:1px solid #ccc}caption{text-align:left;margin:12px 0}</style><h1>Character movement numerical reference</h1><p>Fixed same-ray lookahead; this is a numerical table, not a 3D Viewer.</p><p id="status">Running</p><table><caption>Eight frozen scenes</caption><thead><tr><th>Scene</th><th>Result</th><th>States</th><th>Final position metres / refusal</th><th>First failure</th></tr></thead><tbody></tbody></table><script type="module" src="/bundle.js"></script>';
const server=createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}if(req.url==='/bundle.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundle.outputFiles[0].text);return;}res.writeHead(200,{'content-type':'text/html'});res.end(html);});
let browser,page,browserVersion=null,result,table,clock,cleanup={browserClosed:false,serverClosed:false};const consoleRecords=[],pageErrors=[];
try{
 await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
 browser=await chromium.launch({channel:'chrome',headless:true});browserVersion=browser.version();page=await browser.newPage({viewport:{width:1100,height:760}});
 page.on('console',msg=>consoleRecords.push({type:msg.type(),text:msg.text()}));page.on('pageerror',error=>pageErrors.push(String(error)));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});await page.waitForFunction(()=>window.characterReady===true,{timeout:60000});
 result=await page.evaluate(()=>window.characterResult);
 table=await page.locator('table').innerText();if(await page.locator('tbody tr').count()!==8||!table.includes('WALL_SLIDE')||!table.includes('SPAWN_OVERLAP'))throw new Error('Actual eight-scene table missing');
 clock=await page.evaluate(()=>{let previous=performance.now(),min=Infinity;for(let i=0;i<10000;i++){const next=performance.now();if(next>previous)min=Math.min(min,next-previous);previous=next;}return {minimumPositiveIncrementMs:Number.isFinite(min)?min:null};});
 await page.screenshot({path:resolve(output,'table.png'),fullPage:true});
}catch(error){await writeFile(resolve(output,'failure.json'),JSON.stringify({...metadata,browserVersion,error:String(error.stack??error),consoleRecords,pageErrors},null,2)+'\n');throw error;}
finally{if(browser){await browser.close();cleanup.browserClosed=true;}if(server.listening){await new Promise((accept,reject)=>server.close(error=>error?reject(error):accept()));cleanup.serverClosed=true;}}
const {inputHex,outputHex,...flow}=result;
const files=[];for(const [file,hex]of[['inputs.f64.bin',inputHex],['outputs.f64.bin',outputHex]]){const bytes=Buffer.from(hex,'hex');await writeFile(resolve(output,file),bytes);files.push({file,type:'Float64Array',bytes:bytes.length,elements:bytes.length/8,sha256:createHash('sha256').update(bytes).digest('hex')});}
const report={...metadata,...flow,browserVersion,resolution:{sourceFiles:source.length,compiledFiles:dist.length,sourceAliases:false,customConditions:false},clock,consoleRecords,pageErrors,table,cleanup};
await writeFile(resolve(output,'manifest.json'),JSON.stringify({...metadata,format:'character-movement-reference-raw-v1',endianness:'little',files,totalRawBytes:files.reduce((sum,f)=>sum+f.bytes,0),negativeZeroInputOffsets:result.negativeZeroInputOffsets,negativeZeroOutputOffsets:result.negativeZeroOutputOffsets},null,2)+'\n');
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const clean=consoleRecords.every(r=>r.type!=='error'&&r.type!=='warning')&&!pageErrors.length;
console.log(JSON.stringify({...metadata,browserVersion,go:result.candidateGO&&clean&&cleanup.browserClosed&&cleanup.serverClosed,numeric:result.numericalPassed,controls:result.controls.passed,repeat:result.exactRepeat,rawRepeat:result.exactRawRepeat,clock,cleanup,consoleErrors:consoleRecords.filter(r=>r.type==='error'||r.type==='warning'),pageErrors}));
if(!result.candidateGO||!clean)process.exitCode=1;
