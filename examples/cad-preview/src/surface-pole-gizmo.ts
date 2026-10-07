import type {MeshOptions} from '@barocss/gpu';
import type {Surface} from '@barocss/cad';
import type {Placement,Vec3} from './scene-transform';
import {transformPoint} from './scene-transform';
import {projectNative,buildGizmo,axisParameter} from './transform-gizmo';
import type {GizmoHandle,GizmoLayout} from './transform-gizmo';
export interface PoleMarker {uIndex:number;vIndex:number;point:Vec3;screen:[number,number]}
/** Explicit X-ray control net: original poles, not points on the sampled Surface. */
export function projectSurfacePoles(canvas:HTMLCanvasElement,options:MeshOptions,surface:Surface,placement:Placement):PoleMarker[] {
 const countU=surface.controlPoints.length,countV=surface.controlPoints[0]?.length??0;
 if(countU<2||countU>16||countV<2||countV>16||countU*countV>256||surface.controlPoints.some(row=>row.length!==countV))throw Error('Control net exceeds original2..16 U/V pole limits');
 const markers:PoleMarker[]=[];
 for(let uIndex=0;uIndex<countU;uIndex++)for(let vIndex=0;vIndex<countV;vIndex++){
  const point=surface.controlPoints[uIndex][vIndex],screen=projectNative(canvas,options,transformPoint(point,placement));
  if(screen)markers.push({uIndex,vIndex,point:[...point],screen});
 }
 return markers;
}
/** Near-tied projected poles refuse selection. The indexed list remains available. */
export function hitSurfacePole(markers:PoleMarker[],x:number,y:number):PoleMarker|null {
 const hits=markers.map(marker=>({marker,distance:Math.hypot(x-marker.screen[0],y-marker.screen[1])})).filter(hit=>hit.distance<=9).sort((a,b)=>a.distance-b.distance);
 if(hits.length>1&&hits[1].distance-hits[0].distance<3)throw Error('Control poles overlap in this view. Change view or select the U/V pair in Properties.');
 return hits[0]?.marker??null;
}
/** Reuse the object gizmo projection metric and rotated local axes at the actual pole. */
export function buildPoleGizmo(canvas:HTMLCanvasElement,options:MeshOptions,placement:Placement,surface:Surface,pair:[number,number]):GizmoLayout|null {
 const point=surface.controlPoints[pair[0]]?.[pair[1]];if(!point)return null;
 const layout=buildGizmo(canvas,options,{...placement,translateMM:transformPoint(point,placement)},'scale');
 return layout?{...layout,tool:'translate',handles:layout.handles.filter(handle=>handle.axis!=='uniform')}:null;
}
interface Ray {originMM:number[];direction:number[]}
export interface PoleDrag {layout:GizmoLayout;handle:GizmoHandle;placement:Placement;point:Vec3;startAxis:number}
export function startPoleDrag(layout:GizmoLayout,handle:GizmoHandle,placement:Placement,point:Vec3,ray:Ray):PoleDrag {
 if(handle.axis==='uniform'||handle.disabled)throw Error('Choose an available original pole X, Y or Z handle');
 return {layout,handle,placement:structuredClone(placement),point:[...point],startAxis:axisParameter(ray,layout.pivot,handle.direction)};
}
/** Change one original local coefficient; positive instance scaling is inverted once. */
export function dragPolePoint(drag:PoleDrag,ray:Ray):Vec3 {
 if(drag.handle.axis==='uniform')throw Error('Uniform pole movement is unsupported');
 const axis=drag.handle.axis,point:Vec3=[...drag.point];
 const delta=(axisParameter(ray,drag.layout.pivot,drag.handle.direction)-drag.startAxis)/drag.placement.scaleXYZ[axis];
 if(delta!==0)point[axis]+=delta;
 if(!point.every(Number.isFinite))throw Error('Finite original pole coordinates required');
 return point;
}
