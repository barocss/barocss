/** Runs the installed Playwright CLI only. No package installation or browser download. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const [id,urlText='http://127.0.0.1:52920']=process.argv.slice(2),url=new URL(urlText);
if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??'')||url.hostname!=='127.0.0.1'||url.protocol!=='http:')throw new Error('Usage: browser-run.mjs fresh-id http://127.0.0.1:port');
const cli=process.env.PLAYWRIGHT_CLI;if(!cli||!existsSync(cli))throw new Error('Set PLAYWRIGHT_CLI to an already installed playwright-cli.js. Do not download tools.');
const output=resolve(root,'output/playwright/persistent-impact',id);mkdirSync(dirname(output),{recursive:true});mkdirSync(output,{recursive:false});
const session='persistent-impact-proof-'+id;url.searchParams.set('proof',id);
const source=readFileSync(resolve(here,'browser-checks.js'));writeFileSync(resolve(output,'browser-checks.js'),source,{flag:'wx'});
const cliBytes=readFileSync(cli);writeFileSync(resolve(output,'inputs.json'),JSON.stringify({url:url.href,session,node:process.version,cli,cliSHA256:createHash('sha256').update(cliBytes).digest('hex'),driverSHA256:createHash('sha256').update(source).digest('hex')},null,2)+'\n',{flag:'wx'});
function command(label,args,timeout){const x=spawnSync(process.execPath,[cli,'-s='+session,...args],{cwd:root,encoding:'utf8',timeout,maxBuffer:4*1024*1024});for(const key of ['stdout','stderr'])writeFileSync(resolve(output,label+'.'+key),x[key]??'',{flag:'wx'});writeFileSync(resolve(output,label+'.process.json'),JSON.stringify({status:x.status,signal:x.signal,error:x.error?.message??null})+'\n',{flag:'wx'});if(x.status!==0)throw new Error(label+': '+(x.stderr||x.stdout).slice(-2048));return x.stdout;}
let report,opened=false;
try{
  command('open',['open',url.href,'--browser','chrome'],30000);opened=true;
  const stdout=command('checks',['run-code','--filename',resolve(here,'browser-checks.js')],120000);
  const marker='### Result\n',start=stdout.indexOf(marker),end=stdout.indexOf('\n### Ran Playwright code',start);
  if(start<0||end<0)throw new Error('Browser CLI did not return a structured result');report=JSON.parse(stdout.slice(start+marker.length,end));
}catch(error){report={status:'FAIL_BROWSER_HARNESS',firstFailure:{message:error.message,stack:error.stack}};}
finally{if(opened){try{command('close',['close'],15000);}catch(error){report={...report,status:'FAIL_BROWSER_CLEANUP',cleanupError:error.message};}}}
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,checks:report.checks?.map(c=>({name:c.name,status:c.status})),firstFailure:report.firstFailure??null,reportPath:resolve(output,'report.json')}));
if(report.status!=='PASS_BROWSER_PERSISTENT_IMPACT')process.exitCode=1;
