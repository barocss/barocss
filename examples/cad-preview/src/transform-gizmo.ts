import {prepareCamera} from '@barocss/gpu';
import type {MeshOptions} from '@barocss/gpu';
import type {EditorTool} from './editor-controller';
import type {Placement,Axis,Vec3} from './scene-transform';
import {localAxis,rotationAxis,wrapDegrees} from './scene-transform';
import {nativeToPreview,previewToNative} from './scene-display';
export const axisNames=['X','Y','Z'] as const;
export const axisColors=['#ec8f87','#9ecb92','#88b7ef'] as const;
export const sub=(a:number[],b:number[])=>a.map((n,i)=>n-b[i]);
export const dot=(a:number[],b:number[])=>a.reduce((n,v,i)=>n+v*b[i],0);
export const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function unit(a:number[]):Vec3 {const n=Math.hypot(...a);if(!Number.isFinite(n)||n<1e-12)throw Error('Transform direction unavailable');return a.map(v=>v/n) as Vec3;}
type Screen=[number,number];
export interface GizmoHandle {axis:Axis|'uniform';direction:Vec3;points:Screen[];label:Screen;disabled:boolean}
export interface GizmoLayout {pivot:Vec3;centre:Screen;lengthMM:number;handles:GizmoHandle[];tool:EditorTool}
export function projectNative(canvas:HTMLCanvasElement,options:MeshOptions,p:Vec3):Screen|null {
 const rect=canvas.getBoundingClientRect(),camera=prepareCamera(options.camera!,canvas.width/canvas.height),v=[...nativeToPreview(p).map((n,i)=>n*options.mmToSceneUnit!+options.translate![i]),1];
 const view=[0,1,2,3].map(i=>v.reduce((n,x,k)=>n+camera.view[k*4+i]*x,0)),clip=[0,1,2,3].map(i=>view.reduce((n,x,k)=>n+camera.projection[k*4+i]*x,0));
 if(!clip.every(Number.isFinite)||clip[3]<=0)return null;return[(clip[0]/clip[3]+1)*rect.width/2,(1-clip[1]/clip[3])*rect.height/2];
}
export function buildGizmo(canvas:HTMLCanvasElement,options:MeshOptions,placement:Placement,tool:EditorTool):GizmoLayout|null {
 if(tool==='select')return null;const pivot=placement.translateMM,centre=projectNative(canvas,options,pivot);if(!centre)return null;
 const rect=canvas.getBoundingClientRect(),camera=options.camera!,point=nativeToPreview(pivot).map((n,i)=>n*options.mmToSceneUnit!+options.translate![i]),distance=Math.hypot(...sub(camera.eye,point)),lengthMM=2*distance*Math.tan(camera.fovYDegrees*Math.PI/360)/rect.height/options.mmToSceneUnit!*90;
 if(!Number.isFinite(lengthMM)||lengthMM<=0)return null;
 const handles:GizmoHandle[]=[0,1,2].map(n=>{const axis=n as Axis,direction=tool==='translate'?([0,1,2].map(i=>i===axis?1:0) as Vec3):tool==='scale'?localAxis(axis,placement):rotationAxis(axis,placement);
  let points:Screen[]=[];
  if(tool==='rotate'){const u=unit(cross(direction,Math.abs(direction[2])<.8?[0,0,1]:[0,1,0])),v=cross(direction,u);for(let i=0;i<=64;i++){const a=i*Math.PI/32,p=pivot.map((n,j)=>n+lengthMM*.8*(u[j]*Math.cos(a)+v[j]*Math.sin(a))) as Vec3;const projected=projectNative(canvas,options,p);if(!projected)return{axis,direction,points:[],label:centre,disabled:true};points.push(projected);}}
  else {const end=projectNative(canvas,options,pivot.map((n,i)=>n+direction[i]*lengthMM) as Vec3);points=end?[centre,end]:[];}
  const disabled=points.length<2||Math.max(...points.map(p=>Math.hypot(...sub(p,centre))))<12;
  return{axis,direction,points,label:points[tool==='rotate'?([8,24,40][axis]):points.length-1]??centre,disabled};});
 if(tool==='scale')handles.push({axis:'uniform',direction:[0,0,0],points:[centre],label:centre,disabled:false});return{pivot,centre,lengthMM,handles,tool};
}
function segmentDistance(p:Screen,a:Screen,b:Screen){const d=sub(b,a),length=dot(d,d),t=length?Math.max(0,Math.min(1,dot(sub(p,a),d)/length)):0;return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);}
export function hitGizmo(layout:GizmoLayout,x:number,y:number):GizmoHandle|null {
 let best:GizmoHandle|null=null,min=12;for(const handle of layout.handles){if(handle.disabled)continue;let d=Math.hypot(x-handle.label[0],y-handle.label[1]);if(layout.tool==='rotate')for(let i=1;i<handle.points.length;i++)d=Math.min(d,segmentDistance([x,y],handle.points[i-1],handle.points[i]));if(d<min){min=d;best=handle;}}return best;
}
interface Ray {originMM:number[];direction:number[]}
// The ray and axis are both in native world coordinates. No camera-plane substitute.
export function axisParameter(ray:Ray,pivot:Vec3,axis:Vec3){const o=previewToNative(ray.originMM),d=unit(previewToNative(ray.direction)),w=sub(o,pivot),b=dot(d,axis),den=1-b*b;if(den<1e-4)throw Error('Axis is aligned with the view. Change view or use numeric Transform.');return(dot(axis,w)-b*dot(d,w))/den;}
export function ringVector(ray:Ray,pivot:Vec3,normal:Vec3){const o=previewToNative(ray.originMM),d=unit(previewToNative(ray.direction)),den=dot(d,normal);if(Math.abs(den)<.02)throw Error('Rotation ring is edge-on. Change view or use numeric Transform.');const t=dot(sub(pivot,o),normal)/den;if(t<0)throw Error('Rotation pivot is behind the view');return unit(o.map((n,i)=>n+t*d[i]-pivot[i]));}
export interface TransformDrag {layout:GizmoLayout;handle:GizmoHandle;placement:Placement;start:Screen;startAxis?:number;startRing?:Vec3}
export function startTransform(layout:GizmoLayout,handle:GizmoHandle,placement:Placement,ray:Ray,start:Screen):TransformDrag{return{layout,handle,placement:structuredClone(placement),start,...(handle.axis==='uniform'?{}:layout.tool==='rotate'?{startRing:ringVector(ray,layout.pivot,handle.direction)}:{startAxis:axisParameter(ray,layout.pivot,handle.direction)})};}
export function dragPlacement(drag:TransformDrag,ray:Ray,point:Screen):Placement {
 const p=structuredClone(drag.placement),axis=drag.handle.axis;
 if(axis==='uniform'){const factor=Math.exp((point[0]-drag.start[0]-point[1]+drag.start[1])/100);p.scaleXYZ=p.scaleXYZ.map(n=>n*factor) as Vec3;}
 else if(drag.layout.tool==='translate')p.translateMM[axis]+=axisParameter(ray,drag.layout.pivot,drag.handle.direction)-drag.startAxis!;
 else if(drag.layout.tool==='scale')p.scaleXYZ[axis]*=Math.exp((axisParameter(ray,drag.layout.pivot,drag.handle.direction)-drag.startAxis!)/drag.layout.lengthMM);
 else {const v=ringVector(ray,drag.layout.pivot,drag.handle.direction),angle=Math.atan2(dot(drag.handle.direction,cross(drag.startRing!,v)),dot(drag.startRing!,v))*180/Math.PI;p.rotationDegXYZ[axis]=wrapDegrees(p.rotationDegXYZ[axis]+angle);}
 return p;
}
