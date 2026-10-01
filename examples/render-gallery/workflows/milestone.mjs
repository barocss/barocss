import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recordCapture, verifyArtifacts } from './evidence.mjs';
import { exerciseOrders } from './exercise.mjs';
export async function ordersMilestone(root, url='http://127.0.0.1:5176') {
  const browser=await createRequire(import.meta.url)('playwright-core').chromium.launch({headless:true});
  const candidateSha=execFileSync('git',['-C',fileURLToPath(new URL('../../../',import.meta.url)),'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const results=[];
  try {
    for(const width of [1200,390]) {
      const page=await browser.newPage({viewport:{width,height:900}}), errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{window.CSP_EVENTS=[];document.addEventListener('securitypolicyviolation',e=>window.CSP_EVENTS.push(e.violatedDirective));});
      await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==url){external.push('external-request');return route.abort();}return route.continue();});
      try {
        await page.goto(url);
        const result=await exerciseOrders(page,(name,trace)=>recordCapture({page,root,name:`${name}-${width}`,trace,candidateSha,browserVersion:browser.version(),errors,external}));
        results.push({width,trace:result.trace,bulkIds:result.bulkIds});
      } finally {await page.close();}
    }
    return {url,candidateSha,captures:verifyArtifacts(root).captures.length,results,modelCalls:0};
  } finally {await browser.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==3)throw new Error('Usage: node milestone.mjs ABS_FRESH_EVIDENCE_ROOT');
  console.log(JSON.stringify(await ordersMilestone(process.argv[2]),null,2));
}
