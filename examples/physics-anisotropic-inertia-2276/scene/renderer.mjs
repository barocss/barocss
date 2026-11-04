// Display-only WebGPU triangles. The renderer never advances or changes physics.
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>v.map(x=>x/Math.hypot(...v));
function rotate(q,p){const t=cross(q.slice(0,3),p).map(x=>2*x),u=cross(q.slice(0,3),t);return p.map((x,i)=>x+q[3]*t[i]+u[i]);}
function cameraMatrix(eye,target,aspect){
 const z=unit(sub(eye,target)),x=unit(cross([0,1,0],z)),y=cross(z,x),n=.05,f=100,k=1/Math.tan(Math.PI/9);
 const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
 const projection=[k/aspect,0,0,0,0,k,0,0,0,0,f/(n-f),-1,0,0,f*n/(n-f),0],out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let j=0;j<4;j++)out[c*4+r]+=projection[j*4+r]*view[c*4+j];
 return out;
}
const SHADER=`struct Camera { matrix:mat4x4<f32> }; @group(0) @binding(0) var<uniform> camera:Camera;
struct In { @location(0) p:vec3<f32>, @location(1) n:vec3<f32>, @location(2) c:vec4<f32> };
struct Out { @builtin(position) p:vec4<f32>, @location(0) n:vec3<f32>, @location(1) c:vec4<f32>, @location(2) world:vec3<f32> };
@vertex fn vertex(v:In)->Out { var o:Out; o.p=camera.matrix*vec4(v.p,1); o.n=v.n; o.c=v.c; o.world=v.p; return o; }
@fragment fn fragment(v:Out)->@location(0) vec4<f32> { let light=.38+.62*max(dot(normalize(v.n),normalize(vec3(-.5,1,.6))),0.); var c=v.c.rgb*light; if(v.c.a>.5) { let grid=(i32(floor(v.world.x*2))+i32(floor(v.world.z*2)))&1; c*=.93+.07*f32(grid); } return vec4(c,1); }`;

export async function createRenderer(canvas,onError){
 if(!navigator.gpu)throw Error('WebGPU를 사용할 수 없습니다.');
 const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('GPU 어댑터를 찾을 수 없습니다.');
 const device=await adapter.requestDevice(),context=canvas.getContext('webgpu'),format=navigator.gpu.getPreferredCanvasFormat();
 if(!context)throw Error('WebGPU canvas context unavailable');
 device.addEventListener('uncapturederror',event=>onError(event.error));
 device.lost.then(info=>onError(Error('GPU device lost: '+info.message)));
 context.configure({device,format,alphaMode:'opaque'});
 const shader=device.createShaderModule({code:SHADER}),messages=await shader.getCompilationInfo();
 const errors=messages.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(m=>m.message).join('\n'));
 const bindLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:'uniform'}}]});
 const layout=device.createPipelineLayout({bindGroupLayouts:[bindLayout]});
 const pipeline=device.createRenderPipeline({layout,vertex:{module:shader,entryPoint:'vertex',buffers:[{arrayStride:40,attributes:[
  {shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'}]}]},
  fragment:{module:shader,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
 const markerPipeline=device.createRenderPipeline({layout,
  vertex:{module:shader,entryPoint:'vertex',buffers:[{arrayStride:40,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'}]}]},
  fragment:{module:shader,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'}});
 const vertex=device.createBuffer({size:65536,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
 const uniform=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 const bindings=device.createBindGroup({layout:bindLayout,entries:[{binding:0,resource:{buffer:uniform}}]});
 let depth=null,vertices=0,bodyCount=0,markerCount=0,draws=0,yaw=.65,elevation=.38,distance=11,markers=true,lastBodies=[],submittedVertices=[],submittedMarkerCenters=[];
 function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  if(canvas.width===w&&canvas.height===h&&depth)return;canvas.width=w;canvas.height=h;depth?.destroy();depth=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}
 function present(state,model){
  const data=[],colors=[[.18,.43,.75],[.15,.51,.76],[.20,.57,.74],[.22,.62,.70],[.28,.65,.65],[.39,.65,.58],[.54,.66,.53],[.70,.68,.49]];
  function box(position,rotation,half,color){
   for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const normal=[0,0,0];normal[axis]=sign;const n=rotate(rotation,normal),face=[];
    for(const [u,v]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[0,0,0];p[axis]=sign*half[axis];p[(axis+1)%3]=u*half[(axis+1)%3];p[(axis+2)%3]=v*half[(axis+2)%3];face.push(rotate(rotation,p).map((x,i)=>x+position[i]));}
    for(const i of [0,1,2,0,2,3])data.push(...face[i],...n,...color);
   }
  }
  let index=0;lastBodies=[];
  for(const body of state.bodies){const input=model.bodies.find(b=>b.id===body.id),shape=model.colliders.find(c=>c.bodyId===body.id).geometry;
   box(body.positionM,body.orientationXYZW,shape.halfExtentsM,input.kind==='static'?[.78,.82,.88,1]:[...colors[index++%colors.length],0]);
   lastBodies.push({id:body.id,positionM:[...body.positionM],orientationXYZW:[...body.orientationXYZW],halfExtentsM:[...shape.halfExtentsM]});}
  markerCount=markers?state.contacts.length:0;if(markers)for(const contact of state.contacts)box(contact.pointM,[0,0,0,1],[.017,.017,.017],[.15,.85,.35,0]);
  const array=new Float32Array(data);if(array.byteLength>65536)throw Error('Display vertex budget');
  submittedVertices=lastBodies.map((body,index)=>({id:body.id,worldM:Array.from(array.subarray(index*360,index*360+3))}));
  submittedMarkerCenters=Array.from({length:markerCount},(_,index)=>{const mean=[0,0,0],offset=(state.bodies.length+index)*360;for(let v=0;v<36;v++)for(let k=0;k<3;k++)mean[k]+=array[offset+v*10+k]/36;return mean;});
  device.queue.writeBuffer(vertex,0,array);vertices=data.length/10;bodyCount=state.bodies.length;
 }
 function updateCamera(){const target=[0,2.3,0],eye=[Math.sin(yaw)*Math.cos(elevation)*distance,2.3+Math.sin(elevation)*distance,Math.cos(yaw)*Math.cos(elevation)*distance];
  device.queue.writeBuffer(uniform,0,cameraMatrix(eye,target,canvas.width/canvas.height));
 }
 // Both visible drawing and observation use this exact pass, buffers and pipelines.
 function encodePass(encoder,colorView,depthView){
  const pass=encoder.beginRenderPass({colorAttachments:[{view:colorView,clearValue:{r:.95,g:.965,b:.985,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
  pass.setPipeline(pipeline);pass.setBindGroup(0,bindings);pass.setVertexBuffer(0,vertex);pass.draw(bodyCount*36);
  if(markerCount){pass.setPipeline(markerPipeline);pass.setBindGroup(0,bindings);pass.draw(markerCount*36,1,bodyCount*36);}
  pass.end();
 }
 function draw(){resize();updateCamera();const encoder=device.createCommandEncoder();encodePass(encoder,context.getCurrentTexture().createView(),depth.createView());device.queue.submit([encoder.finish()]);draws++;}
 let reading=false;
 async function readPixels(){
  if(reading)throw Error('Only one GPU readback may be outstanding');reading=true;
  let color=null,copyDepth=null,readback=null,mapped=false;
  try{
   if(format!=='bgra8unorm'&&format!=='rgba8unorm')throw Error('Unsupported observer texture format');
   resize();updateCamera();
   color=device.createTexture({size:[640,360],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
   copyDepth=device.createTexture({size:[640,360],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
   readback=device.createBuffer({size:921600,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   const encoder=device.createCommandEncoder();encodePass(encoder,color.createView(),copyDepth.createView());
   encoder.copyTextureToBuffer({texture:color},{buffer:readback,bytesPerRow:2560,rowsPerImage:360},[640,360]);
   device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);mapped=true;
   const rgba=new Uint8Array(readback.getMappedRange().slice(0));
   if(format==='bgra8unorm')for(let i=0;i<rgba.length;i+=4){const blue=rgba[i];rgba[i]=rgba[i+2];rgba[i+2]=blue;}
   return{width:640,height:360,rgba,format:'rgba8unorm',sourceFormat:format,bytesPerRow:2560};
  }finally{if(mapped)readback.unmap();readback?.destroy();color?.destroy();copyDepth?.destroy();reading=false;}
 }
 let pointer=null;canvas.addEventListener('pointerdown',event=>{pointer=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!pointer)return;yaw+=(event.clientX-pointer[0])*.006;elevation=Math.max(.08,Math.min(1.25,elevation+(event.clientY-pointer[1])*.004));pointer=[event.clientX,event.clientY];});
 canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('wheel',event=>{event.preventDefault();distance=Math.max(4,Math.min(14,distance*Math.exp(event.deltaY*.001)));},{passive:false});
 return {present,draw,readPixels,home(){yaw=.65;elevation=.38;distance=11;},setMarkers(value){markers=value;},snapshot(){return {kind:'WebGPU',bodyCount,markerCount,vertices,draws,width:canvas.width,height:canvas.height,device:adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description}:null,bodies:structuredClone(lastBodies),submittedVertices:structuredClone(submittedVertices),submittedMarkerCenters:structuredClone(submittedMarkerCenters),camera:{yaw,elevation,distance}};}};
}
