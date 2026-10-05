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
import { readbackPng } from '../../../examples/cad-preview/png.mjs';
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
const fixedVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform float aspect;
out vec3 worldNormal;
void main(){
 vec3 p=position-vec3(0.0,0.0,6.0);
 float f=2.414213562373095;
 gl_Position=vec4(p.x*f/aspect,p.y*f,-1.000200020002*p.z-0.02000200020002,-p.z);
 worldNormal=normal;
}`;
const optics = (eye = [0,0,6], changes = {}) => ({ eye, target: [0,0,0], up: [0,1,0], fovYDegrees:45, near:.01, far:100, ...changes });
test('installed Chrome camera matrices preserve fixed reference, orientation, clipping and transactional lifecycle', {timeout:120000}, async () => {
  assert(process.env.CHROME, 'Installed CHROME required'); assert(process.env.PW_DIR, 'Installed PW_DIR required'); await access(process.env.CHROME);
  const {chromium} = createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');
  const sha = execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const evidence = process.env.BAROCSS_GPU_CAMERA_EVIDENCE_DIR ?? `/Users/user/.barocss-ai/v3/gpu-camera-506-${sha.slice(0,8)}`;
  await mkdir(evidence,{recursive:true}); const server = await startServer(); let browser;
  const frames = [], errors = [], requests = [];
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page = await browser.newPage(); page.on('pageerror',e=>errors.push(e.message));
    const allowed = new Set(['/extrusion.js','/compiler.js','/mesh.html','/mesh.js','/mesh-fixtures.js','/gpu.js']);
    await page.route('**/*',route=>{const u=new URL(route.request().url()); if(u.origin!==server.url||!allowed.has(u.pathname)||u.search){requests.push(u.href);return route.abort();}return route.continue();});
    await page.goto(`${server.url}/mesh.html`); await page.waitForFunction(()=>document.querySelector('#status').textContent==='Mesh accepted.');
    const backend = await page.evaluate(async()=>{
      const api=await import('/gpu.js'),canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;document.body.append(canvas);
      const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true}); if(!gl)throw Error('WebGL2 unavailable');
      const debug=gl.getExtension('WEBGL_debug_renderer_info'); const uniforms=[], resources=[];
      const location=gl.getUniformLocation.bind(gl), names=new Map();gl.getUniformLocation=(program,name)=>{const loc=location(program,name);if(loc)names.set(loc,name);return loc;};
      for(const method of ['uniformMatrix4fv','uniform1f','uniform1i','uniform3fv']){const original=gl[method].bind(gl);gl[method]=(...args)=>{uniforms.push({method,name:names.get(args[0])??null,value:ArrayBuffer.isView(args.at(-1))||Array.isArray(args.at(-1))?Array.from(args.at(-1)):args.at(-1),transpose:method==='uniformMatrix4fv'?args[1]:null});return original(...args);};}
      for(const kind of ['Buffer','Shader','Program','VertexArray','Framebuffer','Renderbuffer','Texture']){const method=`create${kind}`,original=gl[method].bind(gl);gl[method]=(...args)=>{const resource=original(...args);if(resource)resources.push({kind,resource});return resource;};}
      window.cameraTest={api,canvas,gl,renderer:null,uniforms,resources};
      return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};
    });
    assert(/SwiftShader/i.test(backend.unmaskedRenderer??''));
    async function capture(name, packet, options=meshOptions, reference=false) {
      const frame = await page.evaluate(({packet,options,reference,fixedVertex})=>{
        const s=window.cameraTest; const source=s.gl.shaderSource.bind(s.gl); s.uniforms.length=0;
        if(reference)s.gl.shaderSource=(shader,text)=>source(shader,s.gl.getShaderParameter(shader,s.gl.SHADER_TYPE)===s.gl.VERTEX_SHADER?fixedVertex:text);
        try {if(s.renderer){const result=s.renderer.update(packet,options);if(!result.ok)throw result.error;}else s.renderer=s.api.mountMesh(s.canvas,packet,options);}
        finally{s.gl.shaderSource=source;}
        return {packet:s.renderer.packet,options:s.renderer.options,revision:s.renderer.revision,shaders:s.renderer.shaders,uniforms:structuredClone(s.uniforms),bytes:Array.from(s.renderer.readPixels()),width:s.canvas.width,height:s.canvas.height,buffer:[s.gl.drawingBufferWidth,s.gl.drawingBufferHeight]};
      }, {packet,options,reference,fixedVertex});
      assert.deepEqual(frame.buffer,[frame.width,frame.height]); assert.equal(frame.bytes.length,frame.width*frame.height*4);
      for(const item of frame.uniforms.filter(item=>item.method==='uniformMatrix4fv')){assert.equal(item.transpose,false);assert.equal(item.value.length,16);assert(item.value.every(Number.isFinite));}
      const files = {[`${name}.accepted.json`]:JSON.stringify({packet:frame.packet,options:frame.options,uniforms:frame.uniforms},null,2),[`${name}.vert.glsl`]:reference?fixedVertex:frame.shaders.vertex,[`${name}.frag.glsl`]:frame.shaders.fragment,[`${name}.png`]:readbackPng(frame.bytes,frame.width,frame.height)};
      const hashes={};for(const [file,content] of Object.entries(files)){await writeFile(path.join(evidence,file),content);hashes[file]=hash(content);}
      const record={name,taskCommit:sha,integrationCommit:process.env.BAROCSS_GPU_INTEGRATION_SHA??null,backend,buffer:frame.buffer,packetHash:hash(JSON.stringify(frame.packet)),optionsHash:hash(JSON.stringify(frame.options)),uniforms:frame.uniforms,readbackHash:hash(Uint8Array.from(frame.bytes)),hashes,masks:mask(frame.bytes,frame.width,frame.height),fixedReference:reference,actualReadPixels:true};
      frames.push(record);await writeFile(path.join(evidence,`${name}.json`),JSON.stringify(record,null,2));return {...frame,...record};
    }
    const compare = (a,b) => {assert.equal(a.bytes.length,b.bytes.length);let maximum=0;for(let i=0;i<a.bytes.length;i++)maximum=Math.max(maximum,Math.abs(a.bytes[i]-b.bytes[i]));assert(maximum<=1,`Fixed reference delta ${maximum}`);return maximum;};
    const reference=await capture('fixed-reference',asymmetric,meshOptions,true);
    const defaults=await capture('default',asymmetric);const defaultDelta=compare(reference,defaults);assert(!Object.hasOwn(defaults.options,'camera'));
    const front=await capture('front',asymmetric,{...meshOptions,camera:optics()});compare(reference,front);assert(front.uniforms.some(u=>u.method==='uniformMatrix4fv'));
    const oblique=await capture('oblique',asymmetric,{...meshOptions,camera:optics([4,3,6])});assert(oblique.masks.foreground>100);assert.notEqual(oblique.readbackHash,front.readbackHash);
    const side=await capture('side-edge',asymmetric,{...meshOptions,camera:optics([6,0,0])});assert(side.masks.foreground<front.masks.foreground*.05);
    const rolled=await capture('up-rolled',asymmetric,{...meshOptions,camera:optics([0,0,6],{up:[1,0,0]})});assert.notEqual(rolled.readbackHash,front.readbackHash);
    const narrow=await capture('fov-narrow',asymmetric,{...meshOptions,camera:optics([0,0,6],{fovYDegrees:30})});assert(narrow.masks.foreground>front.masks.foreground*1.5);
    const wide=await capture('fov-wide',asymmetric,{...meshOptions,camera:optics([0,0,6],{fovYDegrees:80})});assert(wide.masks.foreground<front.masks.foreground*.5);
    const left=await capture('target-left',asymmetric,{...meshOptions,camera:optics([0,0,6],{target:[-.5,0,0]})});assert(left.masks.x>front.masks.x+10);
    const up=await capture('target-up',asymmetric,{...meshOptions,camera:optics([0,0,6],{target:[0,.5,0]})});assert(up.masks.y<front.masks.y-10);
    const nearClip=await capture('near-clipped',asymmetric,{...meshOptions,camera:optics([0,0,6],{near:7})});assert.equal(nearClip.masks.foreground,0);
    const farClip=await capture('far-clipped',asymmetric,{...meshOptions,camera:optics([0,0,6],{far:5})});assert.equal(farClip.masks.foreground,0);
    const behind=await capture('behind-camera',asymmetric,{...meshOptions,camera:optics([0,0,-6],{target:[0,0,-7]})});assert.equal(behind.masks.foreground,0);
    const cylinder=quarterCylinder(),cylinderOptions={...meshOptions,mmToSceneUnit:.1,translate:[-.5,-1.5,0]};
    const cylinderFrames=[];for(const [name,eye]of [['front',[0,0,6]],['side',[6,0,0]],['oblique',[4,3,6]]]){const frame=await capture(`cylinder-${name}`,cylinder,{...cylinderOptions,camera:optics(eye)});assert(frame.masks.foreground>100);cylinderFrames.push(frame);}
    assert.equal(new Set(cylinderFrames.map(f=>f.readbackHash)).size,3);assert.equal(new Set(cylinderFrames.map(f=>f.packetHash)).size,1);
    const depths=depthFixtures(),depthOptions={...meshOptions,camera:optics()};const far=await capture('depth-far',depths.far,depthOptions),near=await capture('depth-near',depths.near,depthOptions),both=await capture('depth-combined',depths.combined,depthOptions);
    assert.notDeepEqual(far.masks.center,near.masks.center);assert.deepEqual(both.masks.center,near.masks.center);
    const failures=await page.evaluate(({packet,options,camera})=>{
      const s=window.cameraTest,r=s.renderer,snapshot=()=>JSON.stringify({packet:r.packet,options:r.options,pixels:Array.from(r.readPixels())}),before=snapshot(),results=[];
      const reject=(name,value)=>{const start=s.resources.length,result=r.update(packet,value);const candidate=s.resources.slice(start);results.push({name,rejected:!result.ok,error:String(result.error),retained:snapshot()===before,resourcesReleased:candidate.every(({kind,resource})=>!s.gl[`is${kind}`](resource))});};
      for(const [name,changed]of [['eye-target',{target:camera.eye}],['up-parallel',{up:[0,0,1]}],['up-zero',{up:[0,0,0]}],['eye-bound',{eye:[1001,0,6]}],['fov-low',{fovYDegrees:9}],['fov-high',{fovYDegrees:101}],['near-low',{near:.00001}],['planes',{near:100,far:1}],['far-bound',{far:10001}],['extra',{foreign:1}]])reject(name,{...options,camera:{...camera,...changed}});
      for(const method of ['uniformMatrix4fv','drawElements']){const original=s.gl[method].bind(s.gl);s.gl[method]=()=>{throw Error(`Injected ${method}`);};try{reject(`${method}-throw`,options);}finally{s.gl[method]=original;}}
      for(const method of ['uniformMatrix4fv','drawElements']){const original=s.gl[method].bind(s.gl);s.gl[method]=(...args)=>method==='uniformMatrix4fv'?original(args[0],false,new Float32Array(15)):original(0xdead,...args.slice(1));try{reject(`${method}-gl-error`,options);}finally{s.gl[method]=original;}}
      const input=structuredClone(options);const response=r.update(packet,input);if(!response.ok)throw response.error;const accepted=snapshot();input.camera.eye[0]=999;r.options.camera.up[0]=999;results.push({name:'nested-copy',rejected:true,retained:snapshot()===accepted,resourcesReleased:true});return results;
    },{packet:depths.combined,options:depthOptions,camera:optics()});
    for(const result of failures)assert(result.rejected&&result.retained&&result.resourcesReleased,JSON.stringify(result));
    await page.evaluate(()=>window.cameraTest.renderer.resize(320,240));const resized=await capture('resized-camera',asymmetric,{...meshOptions,camera:optics([4,3,6])});assert.deepEqual(resized.buffer,[320,240]);
    const lifecycle=await page.evaluate(async({packet,options})=>{const s=window.cameraTest,gl=s.gl;const foreign=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,foreign);gl.bufferData(gl.ARRAY_BUFFER,16,gl.STATIC_DRAW);const owned=s.resources.filter(item=>item.resource!==foreign);s.renderer.dispose();s.renderer.dispose();const released=owned.every(({kind,resource})=>!gl[`is${kind}`](resource));const foreignRetained=gl.isBuffer(foreign);let disposedRead=false;try{s.renderer.readPixels();}catch{disposedRead=true;}
      const absent=document.createElement('canvas');absent.getContext=()=>null;let missing=false;try{s.api.mountMesh(absent,packet,options);}catch{missing=true;}
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const renderer=s.api.mountMesh(canvas,packet,options),lossGl=canvas.getContext('webgl2'),extension=lossGl.getExtension('WEBGL_lose_context');if(!extension)throw Error('Context loss extension unavailable');const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));extension.loseContext();await lost;let lostRead=false,lostResize=false;try{renderer.readPixels();}catch{lostRead=true;}try{renderer.resize(64,64);}catch{lostResize=true;}const lostUpdate=!renderer.update(packet,options).ok;renderer.dispose();return{released,foreignRetained,disposedRead,missing,lostRead,lostResize,lostUpdate};},{packet:asymmetric,options:{...meshOptions,camera:optics()}});
    assert(Object.values(lifecycle).every(Boolean),JSON.stringify(lifecycle));assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await writeFile(path.join(evidence,'index.json'),JSON.stringify({taskCommit:sha,integrationCommit:process.env.BAROCSS_GPU_INTEGRATION_SHA??null,backend,browser:browser.version(),physicalGpuEvidence:false,performanceEvidence:false,defaultReferenceMaxChannelDelta:defaultDelta,frames,failures,lifecycle,errors,requests,limitations:['Explicit SwiftShader software evidence only','Host camera changes mesh presentation only; packet revision remains geometry provenance']},null,2));console.log(`GPU camera evidence: ${evidence}`);
  } finally {if(browser)await browser.close();await server.close();}
});
