// Native-flow observation only. The ordinary app does not install this probe.
export function installResourceProbe(){
 const kinds=['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader'],live=new Map(kinds.map(k=>[k,new Set()])),sizes=new Map(),contexts=new Set();let draws=0;
 for(const kind of kinds){const proto=WebGL2RenderingContext.prototype,make=proto['create'+kind],drop=proto['delete'+kind];proto['create'+kind]=function(...args){const value=make.apply(this,args);if(value)live.get(kind).add(value);return value;};proto['delete'+kind]=function(value){live.get(kind).delete(value);sizes.delete(value);return drop.call(this,value);};}
 const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=original.call(this,kind,...args);if(kind==='webgl2'&&value)contexts.add(value);return value;};
 const proto=WebGL2RenderingContext.prototype,upload=proto.bufferData,draw=proto.drawElements;
 proto.bufferData=function(target,data,...args){const result=upload.call(this,target,data,...args),binding=target===this.ARRAY_BUFFER?this.ARRAY_BUFFER_BINDING:this.ELEMENT_ARRAY_BUFFER_BINDING;sizes.set(this.getParameter(binding),typeof data==='number'?data:data?.byteLength??0);return result;};
 proto.drawElements=function(...args){draws++;return draw.apply(this,args);};
 window.hingeResourceProbe={counts:()=>Object.fromEntries(kinds.map(k=>[k,live.get(k).size])),bytes:()=>[...sizes.values()].reduce((a,b)=>a+b,0),get draws(){return draws;},glErrors:()=>[...contexts].map(gl=>gl.getError()),getContext:()=>[...contexts][0]};
}
