async page => {
 await page.addInitScript(()=>{window.__alphaConsole={errors:[],warnings:[]};const e=console.error,w=console.warn;console.error=(...a)=>{__alphaConsole.errors.push(a.map(String).join(' '));e(...a)};console.warn=(...a)=>{__alphaConsole.warnings.push(a.map(String).join(' '));w(...a)};window.addEventListener('error',e=>__alphaConsole.errors.push(e.message));});
 await page.addInitScript(()=>{
  window.__alphaTaps=[];const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(type!=='webgl2'||!gl||gl.__alphaTap)return gl;
   gl.__alphaTap=true;const r={created:{},deleted:{},handles:{},writes:0,capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};__alphaTaps.push(r);
   for(const k of ['Shader','Program','Buffer','VertexArray','Texture','Framebuffer']){r.created[k]=0;r.deleted[k]=0;r.handles[k]=[];const c=gl['create'+k].bind(gl),d=gl['delete'+k].bind(gl);gl['create'+k]=(...a)=>{const h=c(...a);if(h){r.created[k]++;r.handles[k].push(h)}return h};gl['delete'+k]=h=>{if(h)r.deleted[k]++;return d(h)}}
   for(const name of ['bufferData','bufferSubData','texImage2D','texSubImage2D','uniform4fv','uniform3fv','uniform1f','uniform1i','uniform2f','uniform3f']){const fn=gl[name].bind(gl);gl[name]=(...a)=>{r.writes++;return fn(...a)}}
   r.live=()=>Object.fromEntries(Object.entries(r.handles).map(([k,v])=>[k,v.filter(h=>gl['is'+k](h)).length]));r.error=()=>gl.getError();return gl;};
 });
 await page.goto('http://127.0.0.1:31207/consumer/rgb-matrix.html');
}
