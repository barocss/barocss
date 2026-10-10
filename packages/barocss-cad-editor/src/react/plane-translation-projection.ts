import {prepareCamera,type MeshCamera} from '@barocss/gpu';
import {projectCurvePole,type PolePoint} from './curve-pole-projection.js';

export type ObjectMovePlane='xy'|'xz'|'yz';
type Axis=0|1|2;
export interface PlaneTranslationProjection {
  plane:ObjectMovePlane;
  axes:[Axis,Axis];
  normalAxis:Axis;
  pivotMM:PolePoint;
  widthCss:number;heightCss:number;mmToSceneUnit:number;
  eyeScene:PolePoint;
  inverseView:number[];
  view:number[];
  projection:number[];
  quad:{x:number;y:number}[];
}
const multiply=(matrix:number[],point:number[]):PolePoint=>[0,1,2].map(row=>
  matrix[row*3]*point[0]+matrix[row*3+1]*point[1]+matrix[row*3+2]*point[2]) as PolePoint;
function inverseView(view:Float32Array):number[] {
  const [a,b,c,d,e,f,g,h,i]=[view[0],view[4],view[8],view[1],view[5],view[9],view[2],view[6],view[10]];
  const determinant=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-8)throw new RangeError('A finite camera view is required.');
  return [e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d].map(value=>value/determinant);
}

/** Forward projection of a UI point, with the same public F32 camera and clip limits. */
export function projectPlaneTranslationPoint(frame:PlaneTranslationProjection,pointMM:PolePoint):{x:number;y:number}|null {
  if(!pointMM.every(Number.isFinite))throw new RangeError('A finite display point is required.');
  const p=pointMM.map(value=>value*frame.mmToSceneUnit),view=frame.view,projection=frame.projection;
  const x=view[0]*p[0]+view[4]*p[1]+view[8]*p[2]+view[12];
  const y=view[1]*p[0]+view[5]*p[1]+view[9]*p[2]+view[13];
  const z=view[2]*p[0]+view[6]*p[1]+view[10]*p[2]+view[14],depth=-z;
  const nx=projection[0]*x/depth,ny=projection[5]*y/depth,nz=(projection[10]*z+projection[14])/depth;
  if(depth<=0||![nx,ny,nz].every(Number.isFinite)||Math.abs(nx)>1||Math.abs(ny)>1||nz< -1||nz>1)return null;
  return {x:frame.widthCss*(1+nx)/2,y:frame.heightCss*(1-ny)/2};
}

/** A small authored-world-plane quadrilateral is a UI handle, not native geometry. */
export function preparePlaneTranslationProjection(pivotMM:PolePoint,camera:MeshCamera,mmToSceneUnit:number,
  widthCss:number,heightCss:number,pixelWidth:number,pixelHeight:number,plane:ObjectMovePlane):PlaneTranslationProjection|null {
  if(plane!=='xy'&&plane!=='xz'&&plane!=='yz')throw new RangeError('Choose the XY, XZ or YZ plane.');
  const pivot=projectCurvePole(pivotMM,camera,mmToSceneUnit,widthCss,heightCss,pixelWidth,pixelHeight);
  if(!pivot)return null;
  const axes:[Axis,Axis]=plane==='xy'?[0,1]:plane==='xz'?[0,2]:[1,2],normalAxis:Axis=plane==='xy'?2:plane==='xz'?1:0;
  const {view,projection}=prepareCamera(camera,pixelWidth/pixelHeight);
  if(Math.abs(view[normalAxis*4+2])<0.12)return null;
  const inverse=inverseView(view);
  const frame:PlaneTranslationProjection={plane,axes,normalAxis,pivotMM:[...pivotMM],widthCss,heightCss,mmToSceneUnit,
    eyeScene:multiply(inverse,[-view[12],-view[13],-view[14]]),inverseView:inverse,view:Array.from(view),projection:Array.from(projection),quad:[]};
  const size=44*Math.sqrt(pivot.mmPerCssX*pivot.mmPerCssY);
  if(!Number.isFinite(size)||size<=0)return null;
  for(const [u,v] of [[0.35,0.35],[0.72,0.35],[0.72,0.72],[0.35,0.72]]){
    const point:PolePoint=[...pivotMM];point[axes[0]]+=size*u;point[axes[1]]+=size*v;
    const projected=projectPlaneTranslationPoint(frame,point);if(!projected)return null;
    frame.quad.push(projected);
  }
  const area=Math.abs(frame.quad.reduce((sum,point,index)=>{const next=frame.quad[(index+1)%4];return sum+point.x*next.y-next.x*point.y;},0))/2;
  return Number.isFinite(area)&&area>=16?frame:null;
}

function intersection(frame:PlaneTranslationProjection,xCss:number,yCss:number):PolePoint {
  if(!Number.isFinite(xCss)||!Number.isFinite(yCss))throw new RangeError('A finite pointer is required.');
  const ray=multiply(frame.inverseView,[(2*xCss/frame.widthCss-1)/frame.projection[0],
    (1-2*yCss/frame.heightCss)/frame.projection[5],-1]);
  const denominator=ray[frame.normalAxis],rayScale=Math.hypot(...ray);
  if(!Number.isFinite(denominator)||!Number.isFinite(rayScale)||rayScale===0||Math.abs(denominator)<=rayScale*1e-8)
    throw new RangeError('The movement plane is parallel to the pointer ray.');
  const t=(frame.pivotMM[frame.normalAxis]*frame.mmToSceneUnit-frame.eyeScene[frame.normalAxis])/denominator;
  if(!Number.isFinite(t)||t<=0)throw new RangeError('Plane movement cannot cross the camera horizon.');
  const hit=frame.eyeScene.map((value,index)=>value+ray[index]*t) as PolePoint;
  if(!hit.every(Number.isFinite))throw new RangeError('The plane intersection is not finite.');
  return hit;
}

/** Two original-plane offsets from the captured pointer start; the third axis is exactly +0. */
export function planeTranslationDisplacement(frame:PlaneTranslationProjection,startX:number,startY:number,
  currentX:number,currentY:number,snapStepMM:number|null):PolePoint {
  if(snapStepMM!==null&&(!Number.isFinite(snapStepMM)||snapStepMM<0.000001||snapStepMM>1000000))
    throw new RangeError('Enter a movement step from 0.000001 to 1000000 mm.');
  const start=intersection(frame,startX,startY),current=intersection(frame,currentX,currentY),offset:PolePoint=[0,0,0];
  for(const axis of frame.axes){
    let value=(current[axis]-start[axis])/frame.mmToSceneUnit;
    if(!Number.isFinite(value)||Math.abs(value)>10000)throw new RangeError('Move by up to 10000 mm per axis.');
    if(snapStepMM!==null)value=Math.round(value/snapStepMM)*snapStepMM;
    if(!Number.isFinite(value)||Math.abs(value)>10000)throw new RangeError('Move by up to 10000 mm per axis.');
    offset[axis]=value;
  }
  return offset;
}
