async (page) => {
 await page.addInitScript(() => {
  const proof = window.__gpuProof = {contexts:[],pointerAdds:0,pointerRemoves:0, errors:[],warnings:[]};
  const get = HTMLCanvasElement.prototype.getContext;
  const add = HTMLCanvasElement.prototype.addEventListener;
  const remove = HTMLCanvasElement.prototype.removeEventListener;
  HTMLCanvasElement.prototype.addEventListener=function(t,...a){if(t==='pointerdown')proof.pointerAdds++;return add.call(this,t,...a)};
  HTMLCanvasElement.prototype.removeEventListener=function(t,...a){if(t==='pointerdown')proof.pointerRemoves++;return remove.call(this,t,...a)};
  const error=console.error, warn=console.warn;
  console.error=(...a)=>{proof.errors.push(a.map(String).join(' '));error(...a)};
  console.warn=(...a)=>{proof.warnings.push(a.map(String).join(' '));warn(...a)};
  window.addEventListener('error',e=>proof.errors.push(e.message));
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(type!=='webgl2'||!gl||gl.__tracked)return gl;
   gl.__tracked=true;const record={created:{},deleted:{},handles:{},capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};proof.contexts.push(record);
   for(const kind of ['Shader','Program','Buffer','VertexArray','Texture','Framebuffer']){
    record.created[kind]=0;record.deleted[kind]=0;record.handles[kind]=[];
    const create=gl['create'+kind].bind(gl),del=gl['delete'+kind].bind(gl);
    gl['create'+kind]=(...args)=>{const h=create(...args);if(h){record.created[kind]++;record.handles[kind].push(h)}return h};
    gl['delete'+kind]=h=>{if(h)record.deleted[kind]++;return del(h)};
   }
   record.live=()=>Object.fromEntries(Object.entries(record.handles).map(([k,v])=>[k,v.filter(h=>gl['is'+k](h)).length]));
   return gl;
  };
 });
 console.log('instrumentation ready');
}
