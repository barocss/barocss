import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer } from './server.mjs';
assert(process.env.PW_DIR && process.env.CHROME && process.env.BAROCSS_POLYGON_EDITOR_EVIDENCE);
const output=process.env.BAROCSS_POLYGON_EDITOR_EVIDENCE;await mkdir(output,{recursive:true});
const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');const server=await startServer();
const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1024,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/workspace.html#polygon-prism');await page.waitForFunction(()=>window.polygonWorkspace?.snapshot());
 const state=()=>page.evaluate(()=>window.polygonWorkspace.snapshot());
 const hash=()=>page.evaluate(async()=>{const d=await crypto.subtle.digest('SHA-256',window.polygonWorkspace.readPixels());return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');});
 const initial=await state();assert.equal(initial.evaluation.prism.report.volumeMM3,42);assert.equal(initial.evaluation.prism.report.areaMM2,110);
 await page.screenshot({path:path.join(output,'initial-L.png')});
 await page.fill('#poly-height','8');await page.click('#poly-apply');const height=await state();assert.equal(height.evaluation.prism.report.volumeMM3,56);assert.equal(height.evaluation.prism.report.areaMM2,142);
 // Edit the real draft rows: preserve four vertices and their authored order.
 await page.click('button[aria-label="Remove point 6"]');await page.click('button[aria-label="Remove point 5"]');
 for(const[i,point]of [[0,[0,0]],[1,[4,0]],[2,[4,3]],[3,[0,3]]]){await page.fill('#poly-x-'+i,String(point[0]));await page.fill('#poly-y-'+i,String(point[1]));}
 await page.click('#poly-apply');const rectangle=await state();assert.equal(rectangle.evaluation.prism.report.volumeMM3,96);assert.equal(rectangle.evaluation.prism.report.areaMM2,136);assert.deepEqual(rectangle.bindings,initial.bindings);
 const downloadPromise=page.waitForEvent('download');await page.click('#poly-save');const downloaded=await downloadPromise,filename=path.join(output,'prism.barocad.json');await downloaded.saveAs(filename);
 const document=JSON.parse(await readFile(filename,'utf8'));assert.equal(document.format,'barocss-xy-polygon-prism-feature');assert(!Object.hasOwn(document,'evaluation'));
 await page.click('#poly-triangle');const triangle=await state();assert.equal(triangle.evaluation.prism.report.volumeMM3,27);
 await page.setInputFiles('#poly-open',filename);await page.waitForFunction(()=>window.polygonWorkspace.snapshot().evaluation.prism.report.volumeMM3===96);const reopened=await state();assert.deepEqual(reopened.document,document);
 await page.fill('#poly-height','10');await page.click('#poly-apply');const edited=await state();assert.equal(edited.evaluation.prism.report.volumeMM3,120);assert.deepEqual(edited.bindings,initial.bindings);
 const beforeHash=await hash();await page.fill('#poly-height','0');await page.click('#poly-apply');assert.deepEqual(await state(),edited);assert.equal(await hash(),beforeHash);assert.match(await page.locator('#poly-status').innerText(),/Cannot apply/);
 await page.click('#poly-discard');const bounds=await page.locator('#poly-preview').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+40,bounds.y+bounds.height/2+25,{steps:3});await page.mouse.up();const rotated=await state();assert.deepEqual(rotated.document,edited.document);assert.deepEqual(rotated.packet,edited.packet);assert.notEqual(await hash(),beforeHash);
 await page.screenshot({path:path.join(output,'edited-reopened-prism.png')});assert.deepEqual(errors,[]);
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();await writeFile(path.join(output,'index.json'),JSON.stringify({head,initial,height,rectangle,triangle,reopened,edited,rotated,downloadedIntent:document,invalidHeightRetained:true,orbitPreservedIntent:true,broaderValidation:'deferred',errors},null,2)+'\n');
 console.log('Editable polygon prism: L42→height56→coordinate edit96→actual Save/Open→height120; triangle27; invalid height and orbit passed.');
}finally{await browser.close();await server.close();}
