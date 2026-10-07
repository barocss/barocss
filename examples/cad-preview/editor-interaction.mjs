import {screenRay} from './screen-ray.mjs';
import * as gpu from '/gpu.js';

const selectionCache=new WeakMap(),pickingBindings=new WeakSet();
export function displayObjects(mode,state,packet){
 if(!packet)return [];
 if(state?.display)return(state.display.bodies??state.display.features??[]).map(item=>({id:item.featureId,indexRange:item.indexRange}));
 const id=mode.id==='surface'?state.packet.surfaceId:mode.id==='box'?state.document.feature.bodyId:state?.document?.feature?.bodyId??state?.native?.document?.feature?.shellId??state?.native?.document?.profiles?.[0]?.id??mode.id;
 return[{id,indexRange:[0,packet.indices.length]}];
}
export function highlightObject(renderer,objects,selected){
 if(!renderer)return null;
 const packet=renderer.packet,object=objects.find(item=>item.id===selected),key=selected+':'+packet.revision+':'+(object?.indexRange.join(',')??'none');
 if(selectionCache.get(renderer)===key&&(!object||renderer.objectHighlight?.objectId===selected))return renderer.objectHighlight;
 const highlight=object?{version:0,packet,objectId:object.id,indexRange:object.indexRange,color:[1,.62,.2]}:null,result=renderer.setObjectHighlight(highlight);
 if(!result.ok)throw result.error;
 selectionCache.set(renderer,key);return renderer.objectHighlight;
}
const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// This selects visible accepted preview triangles. It is not an exact native topology query.
export function pickDisplayObject(canvas,renderer,objects,x,y){
 const packet=renderer.packet,ray=screenRay(canvas,renderer.options,x,y,gpu).query;
 let hit=null;
 for(const object of objects)for(let i=object.indexRange[0];i<object.indexRange[1];i+=3){
  const [a,b,c]=packet.indices.slice(i,i+3).map(index=>packet.positions.slice(index*3,index*3+3)),edge1=sub(b,a),edge2=sub(c,a),p=cross(ray.direction,edge2),det=dot(edge1,p);
  if(Math.abs(det)<1e-12)continue;
  const inverse=1/det,t=sub(ray.originMM,a),u=dot(t,p)*inverse;if(u<0||u>1)continue;
  const q=cross(t,edge1),v=dot(ray.direction,q)*inverse;if(v<0||u+v>1)continue;
  const distance=dot(edge2,q)*inverse;
  if(distance>=0&&distance<=ray.maxDistanceMM&&(!hit||distance<hit.distance))hit={id:object.id,distance,triangleOffset:i};
 }
 return hit;
}
export function bindDisplayPicking(canvas,read,select,onError=()=>{}){
 if(pickingBindings.has(canvas))return;pickingBindings.add(canvas);let down;
 canvas.addEventListener('pointerdown',event=>{if(event.button===0&&event.pointerType==='mouse')down={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};});
 canvas.addEventListener('pointermove',event=>{if(down&&event.pointerId===down.id&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>4)down.moved=true;});
 canvas.addEventListener('pointercancel',()=>{down=null;});
 canvas.addEventListener('pointerup',event=>{const start=down;down=null;if(!start||start.id!==event.pointerId||start.moved)return;try{const current=read();if(!current?.renderer)return;const hit=pickDisplayObject(canvas,current.renderer,current.objects,event.clientX,event.clientY);if(hit)select(hit.id);}catch(error){onError('Selection unavailable: '+error.message);}});
}
