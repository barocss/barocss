import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { startServer } from '../../../examples/gpu-scene/server.mjs';
import { asymmetric, quarterCylinder, depthFixtures, meshOptions } from './mesh-fixtures.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function mask(bytes,w,h) {
  const bg = bytes.slice(0,4); let count=0,sumX=0,sumY=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const offset=(y*w+x)*4;
    if(Math.max(...[0,1,2].map(i=>Math.abs(bytes[offset+i]-bg[i])))>12) { count++;sumX+=x;sumY+=y; }
  }
  return { background:bg,foreground:count,ratio:count/(w*h),x:count?sumX/count:null,y:count?sumY/count:null,center:bytes.slice((Math.floor(h/2)*w+Math.floor(w/2))*4,(Math.floor(h/2)*w+Math.floor(w/2))*4+4) };
}
// Encode the actual framebuffer readback. WebGL rows start at the bottom.
function readbackPng(bytes, width, height) {
  const crc32 = data => { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) Buffer.from(bytes.slice((height - y - 1) * width * 4, (height - y) * width * 4)).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
test('installed Chrome draws bounded mesh packets with actual depth and atomic failure retention', {timeout:120000},async()=>{
  assert(process.env.CHROME,'Installed CHROME required');assert(process.env.PW_DIR,'Installed PW_DIR required');await access(process.env.CHROME);
  const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const evidence=process.env.BAROCSS_GPU_MESH_EVIDENCE_DIR??`/Users/user/.barocss-ai/v3/gpu-501-${sha.slice(0,8)}`;
  await mkdir(evidence,{recursive:true});const server=await startServer();let browser;
  const errors=[],requests=[],frames=[];
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    const allowed=new Set(['/mesh.html','/mesh.js','/mesh-fixtures.js','/gpu.js']);
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==server.url||!allowed.has(u.pathname)||u.search){requests.push(u.href);return route.abort();}return route.continue();});
    await page.goto(`${server.url}/mesh.html`);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Mesh accepted.');
    const backend=await page.evaluate(async()=>{
      const api=await import('/gpu.js'),canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;canvas.id='mesh-test';document.body.append(canvas);
      const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 unavailable');
      const debug=gl.getExtension('WEBGL_debug_renderer_info');window.meshTest={api,canvas,gl,renderer:null};
      return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};
    });
    async function capture(name,packet,options=meshOptions) {
      const frame=await page.evaluate(({packet,options})=>{
        const s=window.meshTest;if(s.renderer){const result=s.renderer.update(packet,options);if(!result.ok)throw result.error;}else s.renderer=s.api.mountMesh(s.canvas,packet,options);
        const compiled=s.api.compileGpu({kind:'mesh',packet,options});if(!compiled.ok||compiled.execution.kind!=='indexed-mesh')throw Error('Mesh pipeline failed');return {compiler:{...compiled,execution:{kind:'indexed-mesh',mesh:{...compiled.execution.mesh,positions:[...compiled.execution.mesh.positions],normals:[...compiled.execution.mesh.normals],indices:[...compiled.execution.mesh.indices]}}},packet:s.renderer.packet,revision:s.renderer.revision,options:s.renderer.options,shaders:s.renderer.shaders,bytes:Array.from(s.renderer.readPixels()),width:s.canvas.width,height:s.canvas.height,buffer:[s.gl.drawingBufferWidth,s.gl.drawingBufferHeight]};
      },{packet,options});
      assert.deepEqual(frame.compiler.execution.mesh.packet,frame.packet);assert.deepEqual(frame.compiler.execution.mesh.options,frame.options);
      const compilerFile=`${name}.compiler.json`;await writeFile(path.join(evidence,compilerFile),JSON.stringify(frame.compiler,null,2));
      assert.deepEqual(frame.buffer,[frame.width,frame.height]);assert.equal(frame.bytes.length,frame.width*frame.height*4);
      const summary=mask(frame.bytes,frame.width,frame.height);const filenames=[`${name}.input.json`,`${name}.accepted.json`,`${name}.vert.glsl`,`${name}.frag.glsl`,`${name}.png`];
      const contents=[JSON.stringify({packet,options},null,2),JSON.stringify({packet:frame.packet,options:frame.options},null,2),frame.shaders.vertex,frame.shaders.fragment];
      for(let i=0;i<contents.length;i++)await writeFile(path.join(evidence,filenames[i]),contents[i]);
      await writeFile(path.join(evidence,filenames[4]),readbackPng(frame.bytes,frame.width,frame.height));
      filenames.push(compilerFile);const hashes={};for(const file of filenames)hashes[file]=hash(await readFile(path.join(evidence,file)));
      const result={name,taskCommit:sha,integrationCommit:process.env.BAROCSS_GPU_INTEGRATION_SHA??null,browser:browser.version(),backend,physicalGpuEvidence:false,performanceEvidence:false,scale:options.mmToSceneUnit,buffer:frame.buffer,masks:summary,readbackHash:hash(Uint8Array.from(frame.bytes)),hashes,limits:{vertices:4096,triangles:7938,pixels:4194304},actualReadPixels:true};
      await writeFile(path.join(evidence,`${name}.json`),JSON.stringify(result,null,2));frames.push(result);return {...frame,mask:summary,hash:result.readbackHash};
    }
    const literal=JSON.parse(await readFile(path.join(repo,'examples/gpu-scene/mesh-flat-packet.json'),'utf8'));assert.deepEqual(literal,asymmetric);
    const patch=await capture('asymmetric',literal);assert(patch.mask.foreground>1000&&patch.mask.ratio<.6);
    const cylinder=await capture('quarter-cylinder',quarterCylinder(),{...meshOptions,mmToSceneUnit:.1,translate:[-.5,-1.5,0]});assert(cylinder.mask.foreground>500&&cylinder.mask.ratio<.6);assert.notEqual(cylinder.hash,patch.hash);
    const smaller=await capture('scale',asymmetric,{...meshOptions,mmToSceneUnit:.05});assert(smaller.mask.foreground<patch.mask.foreground*.4);
    const moved=await capture('translation',asymmetric,{...meshOptions,translate:[-.125,-1.5,-.5]});assert(moved.mask.x>patch.mask.x+20);
    const colored=await capture('color',asymmetric,{...meshOptions,color:[.1,1,.2]});assert.notEqual(colored.hash,patch.hash);assert(colored.mask.center[1]>colored.mask.center[0]);
    const geometry=structuredClone(asymmetric);geometry.revision=12;for(let i=0;i<geometry.positions.length;i+=3)geometry.positions[i]*=.5;geometry.bounds.min[0]*=.5;geometry.bounds.max[0]*=.5;
    const edited=await capture('geometry-revision',geometry);assert.equal(edited.revision,12);assert(edited.mask.foreground<patch.mask.foreground*.7);
    const offscreen=await capture('background',asymmetric,{...meshOptions,translate:[100,0,0]});assert.equal(offscreen.mask.foreground,0);
    const depths=depthFixtures();const far=await capture('far-control',depths.far),near=await capture('near-control',depths.near),both=await capture('depth-near-first',depths.combined);
    assert.notDeepEqual(far.mask.center,near.mask.center,'Normal lighting controls must differ');assert.deepEqual(both.mask.center,near.mask.center,'Far triangles submitted last must not overwrite near pixels');
    const failures=await page.evaluate(({packet,options})=>{
      const s=window.meshTest,r=s.renderer;const snapshot=()=>JSON.stringify({packet:r.packet,revision:r.revision,options:r.options,pixels:Array.from(r.readPixels())});const before=snapshot();const results=[];
      const allocated=[];const creators=['Buffer','Shader','Program','VertexArray','Framebuffer','Renderbuffer','Texture'];const originalCreators={};
      for(const kind of creators){const method=`create${kind}`,original=s.gl[method].bind(s.gl);originalCreators[method]=original;s.gl[method]=(...args)=>{const resource=original(...args);if(resource)allocated.push({kind,resource});return resource;};}
      const reject=(name,p,o=options)=>{const start=allocated.length,response=r.update(p,o);const candidates=allocated.slice(start);results.push({name,rejected:!response.ok,error:String(response.error),retained:snapshot()===before,candidateResources:candidates.length,candidateResourcesReleased:candidates.every(({kind,resource})=>!s.gl[`is${kind}`](resource))});};
      const cases={version:p=>p.version=1,missing:p=>delete p.parameters,count:p=>p.positions.pop(),index:p=>p.indices[0]=9999,normal:p=>p.normals[0]=2,bounds:p=>p.bounds.min[0]-=1,winding:p=>[p.indices[0],p.indices[1]]=[p.indices[1],p.indices[0]],nonfinite:p=>p.positions[0]=NaN,degenerate:p=>p.indices[1]=p.indices[0]};
      for(const [name,mutate]of Object.entries(cases)){const p=structuredClone(packet);mutate(p);reject(name,p);}
      const collapsed={...structuredClone(packet),positions:[999999,-1,0,999999,1,0,999999.00001,-1,0,999999.00001,1,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],indices:[0,2,1,2,3,1],parameters:[0,0,0,1,1,0,1,1],bounds:{min:[999999,-1,0],max:[999999.00001,1,0]}};
      reject('float32-collapse',collapsed,{...options,mmToSceneUnit:.0001});
      reject('options-scale',packet,{...options,mmToSceneUnit:0});reject('options-placement',packet,{...options,translate:[Infinity,0,0]});reject('options-color',packet,{...options,color:[2,0,0]});
      for(const method of ['bufferData','drawElements']){const original=s.gl[method].bind(s.gl);s.gl[method]=()=>{throw Error(`Injected ${method} failure`);};try{reject(method,packet);}finally{s.gl[method]=original;}}
      for(const method of ['bufferData','drawElements']){const original=s.gl[method].bind(s.gl);s.gl[method]=(...args)=>original(0xdead,...args.slice(1));try{reject(`${method}-gl-error`,packet);}finally{s.gl[method]=original;}}
      const source=s.gl.shaderSource.bind(s.gl);s.gl.shaderSource=(shader,text)=>source(shader,text+'\ninvalid shader tokens');try{reject('compile',packet);}finally{s.gl.shaderSource=source;}
      const param=s.gl.getProgramParameter.bind(s.gl);s.gl.getProgramParameter=(program,pname)=>pname===s.gl.LINK_STATUS?false:param(program,pname);try{reject('link',packet);}finally{s.gl.getProgramParameter=param;}
      for(const [method,original]of Object.entries(originalCreators))s.gl[method]=original;
      const copied=r.packet;copied.positions[0]=999;const copiedOptions=r.options;copiedOptions.translate[0]=999;results.push({name:'getter-copies',rejected:true,error:'none',retained:snapshot()===before});
      return results;
    },{packet:depths.combined,options:meshOptions});
    for(const result of failures)assert(result.rejected&&result.retained&&result.candidateResourcesReleased!==false,JSON.stringify(result));
    const inputOwnership=await page.evaluate(({packet,options})=>{const r=window.meshTest.renderer;const response=r.update(packet,options);if(!response.ok)throw response.error;packet.positions[0]=999;options.translate[0]=999;return r.packet.positions[0]!==999&&r.options.translate[0]!==999;},{packet:asymmetric,options:meshOptions});assert(inputOwnership);
    await page.evaluate(()=>window.meshTest.renderer.resize(320,240));const resized=await capture('resize',asymmetric);assert.deepEqual(resized.buffer,[320,240]);
    const lifecycle=await page.evaluate(async({packet,options})=>{
      const s=window.meshTest,gl=s.gl;const foreign=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,foreign);gl.bufferData(gl.ARRAY_BUFFER,16,gl.STATIC_DRAW);
      const released=[];const deleted=[];for(const method of ['deleteBuffer','deleteShader','deleteProgram','deleteVertexArray','deleteFramebuffer','deleteRenderbuffer','deleteTexture']){const original=gl[method].bind(gl);gl[method]=resource=>{deleted.push({method,foreign:resource===foreign});if(resource)released.push({kind:method.slice(6),resource});original(resource);};}
      s.renderer.dispose();s.renderer.dispose();let readRejected=false,resizeRejected=false;try{s.renderer.readPixels();}catch{readRejected=true;}try{s.renderer.resize(32,32);}catch{resizeRejected=true;}
      const disposed={foreignRetained:gl.isBuffer(foreign),ownedResourcesReleased:released.length>0&&released.every(({kind,resource})=>!gl[`is${kind}`](resource)),deleted,readRejected,resizeRejected,updateRejected:!s.renderer.update(packet,options).ok};
      const absent=document.createElement('canvas');absent.getContext=()=>null;let missing=false;try{s.api.mountMesh(absent,packet,options);}catch{missing=true;}
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const renderer=s.api.mountMesh(canvas,packet,options),lossGl=canvas.getContext('webgl2'),extension=lossGl.getExtension('WEBGL_lose_context');if(!extension)throw Error('Context loss extension unavailable');const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));extension.loseContext();await lost;
      let lostRead=false,lostResize=false;try{renderer.readPixels();}catch{lostRead=true;}try{renderer.resize(16,16);}catch{lostResize=true;}const lostUpdate=!renderer.update(packet,options).ok;renderer.dispose();return {disposed,missing,lostRead,lostResize,lostUpdate};
    },{packet:asymmetric,options:meshOptions});
    assert(lifecycle.disposed.foreignRetained&&lifecycle.disposed.ownedResourcesReleased&&lifecycle.disposed.readRejected&&lifecycle.disposed.resizeRejected&&lifecycle.disposed.updateRejected);assert(lifecycle.disposed.deleted.length>0&&lifecycle.disposed.deleted.every(item=>!item.foreign));assert(lifecycle.missing&&lifecycle.lostRead&&lifecycle.lostResize&&lifecycle.lostUpdate);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await writeFile(path.join(evidence,'index.json'),JSON.stringify({taskCommit:sha,integrationCommit:process.env.BAROCSS_GPU_INTEGRATION_SHA??null,backend,backendDescription:'Explicit ANGLE SwiftShader software WebGL2; functional evidence only',failureControls:{bufferData:'thrown JavaScript exception before upload',drawElements:'thrown JavaScript exception before draw','bufferData-gl-error':'real invalid enum upload target','drawElements-gl-error':'real invalid enum draw mode',compile:'invalid GLSL tokens after shaderSource',link:'LINK_STATUS forced false after actual GL link'},frames,failures,inputOwnership,lifecycle,errors,requests,quarterCylinderPlacement:'Host -90 degree X rotation, scale .1 mmToSceneUnit, translation [-.5,-1.5,0]'},null,2));console.log(`GPU mesh evidence: ${evidence}`);
  }finally{if(browser)await browser.close();await server.close();}
});
