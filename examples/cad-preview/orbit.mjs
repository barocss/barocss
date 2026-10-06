// Host-only mouse orbit: presentation changes use the existing validated camera transaction.
export const defaultOrbitCamera={eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100};
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(vector){const scale=Math.max(...vector.map(Math.abs));if(!Number.isFinite(scale)||scale===0)throw new RangeError('Invalid orbit axis');const scaled=vector.map(value=>value/scale),length=Math.hypot(...scaled);return scaled.map(value=>value/length);}
function rotate(vector,axis,angle){const c=Math.cos(angle),s=Math.sin(angle),perpendicular=cross(axis,vector),parallel=dot(axis,vector);return vector.map((value,index)=>value*c+perpendicular[index]*s+axis[index]*parallel*(1-c));}
export function orbitCamera(camera,dx,dy,width,height){
 if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)throw new RangeError('Finite drag and positive viewport dimensions required');
 const result=structuredClone(camera),offset=camera.eye.map((value,index)=>value-camera.target[index]),up=unit(camera.up),direction=unit(offset);
 const theta=Math.acos(Math.max(-1,Math.min(1,dot(direction,up))));
 // Preserve an already near-pole starting pose; constrain movement toward either singular axis.
 const lower=Math.min(theta,.02),upper=Math.max(theta,Math.PI-.02);
 const pitch=Math.max(lower,Math.min(upper,theta+dy*Math.PI/height))-theta;
 const yaw=(-dx/width*2*Math.PI)%(2*Math.PI);
 const horizontal=rotate(offset,up,yaw),right=unit(cross(up,unit(horizontal))),moved=rotate(horizontal,right,pitch);
 result.eye=moved.map((value,index)=>value+camera.target[index]);
 return result;
}
export function bindMouseOrbit(canvas,host,onAccepted=()=>{}){
 let gesture,disposed=false;
 const view=canvas.ownerDocument?.defaultView;
 function end(){const previous=gesture;gesture=undefined;canvas.classList.remove('is-dragging');if(previous&&canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);}
 function down(event){
  if(disposed||gesture||event.pointerType!=='mouse'||!event.isPrimary||event.button!==0||!host.available)return;
  const accepted=host.snapshot(),rect=canvas.getBoundingClientRect();if(!accepted||rect.width<=0||rect.height<=0)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,width:rect.width,height:rect.height,camera:structuredClone(accepted.options.camera??defaultOrbitCamera),viewRevision:accepted.viewRevision};
  canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');event.preventDefault();
 }
 function move(event){
  if(!gesture||event.pointerId!==gesture.id)return;
  if(!host.available||host.snapshot()?.viewRevision!==gesture.viewRevision){end();return;}
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(dx===0&&dy===0)return;
  try{const camera=orbitCamera(gesture.camera,dx,dy,gesture.width,gesture.height),result=host.setCamera(camera);
   if(result.ok){gesture.viewRevision=host.snapshot().viewRevision;onAccepted(camera);}else end();
  }catch{end();}
  event.preventDefault();
 }
 function up(event){if(gesture?.id===event.pointerId)end();}
 const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,webglcontextlost:end};
 for(const [name,listener] of Object.entries(events))canvas.addEventListener(name,listener);
 view?.addEventListener('blur',end);
 return{dispose(){if(disposed)return;disposed=true;end();for(const [name,listener] of Object.entries(events))canvas.removeEventListener(name,listener);view?.removeEventListener('blur',end);}};
}
