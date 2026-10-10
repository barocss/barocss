async (page) => {
 return await page.evaluate(async()=>{
  const {createCanvas2D}=await import('../dist/index.js');
  const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,stencil:true,preserveDrawingBuffer:true});
  const created={shader:0,program:0,buffer:0,vertexArray:0},deleted={shader:0,program:0,buffer:0,vertexArray:0};const programs=[];
  for(const kind of Object.keys(created)){const C=kind[0].toUpperCase()+kind.slice(1);const create=gl['create'+C].bind(gl),del=gl['delete'+C].bind(gl);gl['create'+C]=(...a)=>{created[kind]++;const r=create(...a);if(kind==='program')programs.push(r);return r;};gl['delete'+C]=(r)=>{if(r)deleted[kind]++;return del(r);};}
  const renderer=createCanvas2D(canvas,{logicalSize:{width:20,height:20},dpr:2});
  const linked=programs.map(p=>({linked:gl.getProgramParameter(p,gl.LINK_STATUS),uniforms:Array.from({length:gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS)},(_,i)=>{const u=gl.getActiveUniform(p,i);return{name:u.name,size:u.size,type:u.type};})}));
  const capacity=gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);renderer.dispose();
  const refusedCanvas=document.createElement('canvas'),rg=refusedCanvas.getContext('webgl2',{stencil:true});let shaders=0,programCount=0;const oldParameter=rg.getParameter.bind(rg);rg.getParameter=p=>p===rg.MAX_FRAGMENT_UNIFORM_VECTORS?127:oldParameter(p);for(const n of ['createShader','createProgram']){const f=rg[n].bind(rg);rg[n]=(...a)=>{if(n==='createShader')shaders++;else programCount++;return f(...a);};}let code=null;try{createCanvas2D(refusedCanvas,{logicalSize:{width:20,height:20},dpr:2});}catch(e){code=e.code;}
  return {userAgent:navigator.userAgent,capacity,linked,created,deleted,glError:gl.getError(),injectedReported127:{code,shaders,programCount}};
 });
}
