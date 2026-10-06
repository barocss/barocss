import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {startServer} from './server.mjs';
const output=process.env.BAROCSS_CAD_IMPORT_EVIDENCE,issue=Number(process.env.BAROCSS_NATIVE_ISSUE);
assert(output&&process.env.PW_DIR&&process.env.CHROME&&process.env.BAROCSS_CAD_REGISTRATION_PROPOSAL);
await mkdir(output,{recursive:true});const proposal=JSON.parse(await readFile(process.env.BAROCSS_CAD_REGISTRATION_PROPOSAL,'utf8'));
const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');const server=await startServer();let browser;
try{
 const modules={};for(const[name,expected]of Object.entries(proposal.modules)){const route=name==='index.js'?'/cad.js':'/'+name,res=await fetch(server.url+route);assert.equal(res.status,200,route);assert.match(res.headers.get('content-type'),/javascript/);modules[name]=createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');assert.equal(modules[name],expected.sha256,route);}
 browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[],requests=new Set();page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{const url=new URL(response.url());if(url.origin===server.url&&url.pathname.endsWith('.js'))requests.add(url.pathname);});
 const response=await page.goto(server.url+'/#sphere');assert(response.headers()['content-security-policy'].includes("script-src 'self'"));await page.waitForFunction(()=>window.examplePreview?.snapshot());
 const record=await page.evaluate(async issue=>{
  const api=await import('/cad.js'),native=api.buildXYPolygonRegion({id:'browser_L',points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]});
  if(issue===566){const face=api.buildXYPolygonPlanarFace(native.curve,{faceId:'browser_face'}),answer=api.classifyXYPolygonPlanarFacePoint(face.bundle,[2,2,0]);if(face.report.edgeCount!==6||answer.classification!=='outside'||face.report.solid!==false)throw new Error('Actual planar trim face import/query failed');return{report:face.report,answer};}
  if(issue===567){const shell=api.buildXYPolygonPrismShell(native.curve,{bodyId:'browser_shell',distanceMM:6}),report=api.validateXYPolygonPrismShell(shell.shell);if(report.faceCount!==8||report.edgeCount!==18||report.edgeUseCount!==36||!report.closed||report.solid!==false)throw new Error('Actual native prism shell import/incidence failed');return{report};}
  if(issue===569){const shell=api.buildXYPolygonPrismShell(native.curve,{bodyId:'browser_shell',distanceMM:6}),preview=api.tessellateXYPolygonPrismShell(shell.shell,{meshId:'browser_mesh',revision:1}),gpu=await import('/gpu.js');gpu.validatePreviewPacket(preview.packet);if(preview.packet.positions.length!==108||preview.packet.indices.length!==60||preview.edgePaths.length!==18||preview.faceRanges.length!==8)throw new Error('Actual native face packet/edge import failed');return{report:preview.report,packet:preview.packet,faceRanges:preview.faceRanges,edgeProvenance:preview.edgeProvenance,edgePaths:preview.edgePaths,gpuPacketAdmitted:true};}
  if(issue===571){const shell=api.buildXYPolygonPrismShell(native.curve,{bodyId:'browser_shell',distanceMM:6}),hit=api.queryXYPolygonPrismShellRay(shell.shell,{originMM:[.5,3,8],direction:[0,0,-1],maxDistanceMM:20}),miss=api.queryXYPolygonPrismShellRay(shell.shell,{originMM:[2,2,8],direction:[0,0,-1],maxDistanceMM:20});if(hit.status!=='unique-hit'||Math.abs(hit.nearestDistanceMM-2)>1e-7||miss.status!=='miss')throw new Error('Actual native face ray import/query failed');return{hit,miss};}
  throw new Error('Unsupported native smoke issue');
 },issue);
 const reachable=new Set();function visit(name){if(reachable.has(name))return;assert(proposal.modules[name],'Unregistered native import: '+name);reachable.add(name);for(const dependency of proposal.modules[name].imports){assert(dependency.startsWith('./'));visit(dependency.slice(2));}}visit('index.js');for(const name of reachable)assert(requests.has(name==='index.js'?'/cad.js':'/'+name),name);assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'index.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),issue,nativeHead:proposal.head,modules,runtimeModules:[...reachable].sort(),requests:[...requests].sort(),record,errors,scope:'Actual bounded native API/module import only; no new GUI/raster or general certification; broader validation deferred'},null,2)+'\n');console.log('Native child',issue,'actual API and import closure passed:',Object.keys(modules).length,'served,',reachable.size,'reachable modules.');
}finally{if(browser)await browser.close();await server.close();}
