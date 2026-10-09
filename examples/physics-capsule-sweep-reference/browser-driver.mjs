import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const directory=dirname(fileURLToPath(import.meta.url)),root=resolve(directory,'../..');
const metadata={gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),nodeVersion:process.version};
const output=resolve(process.argv[2]??'/tmp/physics-sweep-browser');
const toolPath=process.argv[3]??'/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(toolPath);
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const path=resolve(directory,'.'+pathname);if(!path.startsWith(directory+'/'))throw new Error('Outside example');
 const bytes=await readFile(path);res.writeHead(200,{'content-type':extname(path)==='.html'?'text/html':'text/javascript','cache-control':'no-store'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],warnings=[];
try{browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1000,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
 const url='http://127.0.0.1:'+server.address().port+'/browser.html';await page.goto(url);await page.waitForFunction(()=>window.referenceReady===true);
 const result=await page.evaluate(()=>window.runReference());await mkdir(output,{recursive:true});await page.screenshot({path:resolve(output,'numeric-cases.png'),fullPage:true});
 const {inputHex,outputHex,...report}=result;await writeFile(resolve(output,'inputs.f64.bin'),Buffer.from(inputHex,'hex'));await writeFile(resolve(output,'outputs.f64.bin'),Buffer.from(outputHex,'hex'));
 await writeFile(resolve(output,'report.json'),JSON.stringify({...metadata,browserVersion:browser.version(),url,...report,errors,warnings},null,2)+'\n');
 console.log(JSON.stringify({...metadata,output,browserVersion:browser.version(),passed:result.passed,inputsSha256:result.inputsSha256,outputsSha256:result.outputsSha256,errors,warnings,
 maximumCaseP95Ms:Math.max(...result.timing.trials.flat().map(t=>t.p95Ms)),actualViewer:false}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
