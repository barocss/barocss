async page=>{await page.addInitScript(()=>{
const p=window.__gpuProof={contexts:[],errors:[],warnings:[]};const get=HTMLCanvasElement.prototype.getContext;
const error=console.error,warn=console.warn;console.error=(...a)=>{p.errors.push(a.map(String).join(' '));error(...a)};console.warn=(...a)=>{p.warnings.push(a.map(String).join(' '));warn(...a)};window.addEventListener('error',e=>p.errors.push(e.message));
HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(type!=='webgl2'||!gl||gl.__tracked)return gl;gl.__tracked=true;
const r={created:{},deleted:{},handles:{},capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};p.contexts.push(r);
for(const k of ['Shader','Program','Buffer','VertexArray','Texture','Framebuffer']){r.created[k]=0;r.deleted[k]=0;r.handles[k]=[];const c=gl['create'+k].bind(gl),d=gl['delete'+k].bind(gl);gl['create'+k]=(...a)=>{const h=c(...a);if(h){r.created[k]++;r.handles[k].push(h)}return h};gl['delete'+k]=h=>{if(h)r.deleted[k]++;return d(h)}}
r.live=()=>Object.fromEntries(Object.entries(r.handles).map(([k,v])=>[k,v.filter(h=>gl['is'+k](h)).length]));r.error=()=>gl.getError();return gl};
});await page.reload();}