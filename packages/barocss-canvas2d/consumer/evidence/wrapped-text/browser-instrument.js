async (page) => {
 await page.addInitScript(() => {
  const proof = window.__gpuProof = {contexts:[],scratchCanvases:[],pointerAdds:0,pointerRemoves:0,scratch2D:0,draws:0,fontLoads:0,fontChecks:0,errors:[],warnings:[]};
  const get=HTMLCanvasElement.prototype.getContext,add=HTMLCanvasElement.prototype.addEventListener,remove=HTMLCanvasElement.prototype.removeEventListener;
  HTMLCanvasElement.prototype.addEventListener=function(t,...a){if(t==='pointerdown')proof.pointerAdds++;return add.call(this,t,...a)};
  HTMLCanvasElement.prototype.removeEventListener=function(t,...a){if(t==='pointerdown')proof.pointerRemoves++;return remove.call(this,t,...a)};
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(...a){proof.draws++;return fill.apply(this,a)};
  const load=document.fonts.load.bind(document.fonts),check=document.fonts.check.bind(document.fonts);
  document.fonts.load=(...a)=>{proof.fontLoads++;return load(...a)};
  document.fonts.check=(...a)=>{proof.fontChecks++;return check(...a)};
  const error=console.error,warn=console.warn;
  console.error=(...a)=>{proof.errors.push(a.map(String).join(' '));error(...a)};
  console.warn=(...a)=>{proof.warnings.push(a.map(String).join(' '));warn(...a)};
  window.addEventListener('error',e=>proof.errors.push(e.message));
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);
   if(type==='2d'&&gl&&!gl.__tracked2D){gl.__tracked2D=true;proof.scratch2D++;proof.scratchCanvases.push(this)}
   if(type!=='webgl2'||!gl||gl.__tracked)return gl;
   gl.__tracked=true;const record={created:{},deleted:{},handles:{},capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};proof.contexts.push(record);
   for(const kind of ['Shader','Program','Buffer','VertexArray','Texture','Framebuffer']){
    record.created[kind]=0;record.deleted[kind]=0;record.handles[kind]=[];
    const create=gl['create'+kind].bind(gl),del=gl['delete'+kind].bind(gl);
    gl['create'+kind]=(...a)=>{const h=create(...a);if(h){record.created[kind]++;record.handles[kind].push(h)}return h};
    gl['delete'+kind]=h=>{if(h)record.deleted[kind]++;return del(h)};
   }
   record.live=()=>Object.fromEntries(Object.entries(record.handles).map(([k,v])=>[k,v.filter(h=>gl['is'+k](h)).length]));
   record.error=()=>gl.getError();return gl;
  };
 });
 await page.goto('http://127.0.0.1:31199/consumer/browser-text.html');
}
