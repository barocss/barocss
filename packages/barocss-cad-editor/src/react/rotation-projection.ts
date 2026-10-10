import {prepareCamera, type MeshCamera} from '@barocss/gpu';
import type {CadEditorRotationAxis} from '../types.js';
import {projectCurvePole, type PolePoint} from './curve-pole-projection.js';

export interface RotationProjection {
  axis: CadEditorRotationAxis;
  pivotMM: PolePoint;
  basisU: PolePoint;
  basisV: PolePoint;
  radiusMM: number;
  xCss: number;
  yCss: number;
  widthCss: number;
  heightCss: number;
  mmToSceneUnit: number;
  eyeScene: PolePoint;
  inverseView: number[];
  view:number[];
  projectionX: number;
  projectionY: number;
  ring: {x:number;y:number}[];
}
const axisIndex = (axis:CadEditorRotationAxis) => axis==='x'?0:axis==='y'?1:2;
const multiply = (matrix:number[],p:number[]):PolePoint => [0,1,2].map(row=>
  matrix[row*3]*p[0]+matrix[row*3+1]*p[1]+matrix[row*3+2]*p[2]) as PolePoint;

/** Display-only inversion of the actual public camera's linear view matrix. */
function inverseView(view:Float32Array):number[] {
  const [a,b,c,d,e,f,g,h,i]=[view[0],view[4],view[8],view[1],view[5],view[9],view[2],view[6],view[10]];
  const determinant=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-8)throw new RangeError('A finite camera view is required.');
  return [e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d].map(value=>value/determinant);
}

/** A projected world-plane ring is an approximate UI handle, not authored Curve geometry. */
export function prepareRotationProjection(pivotMM:PolePoint,camera:MeshCamera,mmToSceneUnit:number,
  widthCss:number,heightCss:number,pixelWidth:number,pixelHeight:number,axis:CadEditorRotationAxis):RotationProjection|null {
  if(axis!=='x'&&axis!=='y'&&axis!=='z')throw new RangeError('Choose a world rotation axis.');
  if(widthCss<=0||heightCss<=0||pixelWidth<=0||pixelHeight<=0)return null;
  const pivot=projectCurvePole(pivotMM,camera,mmToSceneUnit,widthCss,heightCss,pixelWidth,pixelHeight);
  if(!pivot)return null;
  const {view,projection}=prepareCamera(camera,pixelWidth/pixelHeight);
  if(Math.abs(view[axisIndex(axis)*4+2])<0.12)return null;
  const basisU:PolePoint=axis==='x'?[0,1,0]:axis==='y'?[0,0,1]:[1,0,0];
  const basisV:PolePoint=axis==='x'?[0,0,1]:axis==='y'?[1,0,0]:[0,1,0];
  const radiusMM=64*Math.sqrt(pivot.mmPerCssX*pivot.mmPerCssY);
  const ring:{x:number;y:number}[]=[];
  for(let index=0;index<=64;index++) {
    const theta=index/64*Math.PI*2;
    const point=pivotMM.map((value,dimension)=>value+radiusMM*(basisU[dimension]*Math.cos(theta)+basisV[dimension]*Math.sin(theta))) as PolePoint;
    const projected=projectCurvePole(point,camera,mmToSceneUnit,widthCss,heightCss,pixelWidth,pixelHeight);
    if(!projected)return null;
    ring.push({x:projected.xCss,y:projected.yCss});
  }
  const inverse=inverseView(view);
  return {axis,pivotMM:[...pivotMM],basisU,basisV,radiusMM,xCss:pivot.xCss,yCss:pivot.yCss,widthCss,heightCss,
    mmToSceneUnit,eyeScene:multiply(inverse,[-view[12],-view[13],-view[14]]),inverseView:inverse,view:Array.from(view),
    projectionX:projection[0],projectionY:projection[5],ring};
}

/** Ray-plane pointer angle in radians, increasing by the selected right-hand world axis. */
export function rotationPointerAngle(projection:RotationProjection,xCss:number,yCss:number):number {
  if(!Number.isFinite(xCss)||!Number.isFinite(yCss))throw new RangeError('A finite pointer is required.');
  const ray=multiply(projection.inverseView,[(xCss*2/projection.widthCss-1)/projection.projectionX,
    (1-yCss*2/projection.heightCss)/projection.projectionY,-1]);
  const axis=axisIndex(projection.axis),denominator=ray[axis];
  if(!Number.isFinite(denominator)||Math.abs(denominator)<1e-8)throw new RangeError('The rotation plane is parallel to the pointer ray.');
  const t=(projection.pivotMM[axis]*projection.mmToSceneUnit-projection.eyeScene[axis])/denominator;
  if(!Number.isFinite(t)||t<=0)throw new RangeError('Rotation cannot cross the camera horizon.');
  const delta=projection.eyeScene.map((value,index)=>(value+ray[index]*t)/projection.mmToSceneUnit-projection.pivotMM[index]);
  const u=delta.reduce((sum,value,index)=>sum+value*projection.basisU[index],0);
  const v=delta.reduce((sum,value,index)=>sum+value*projection.basisV[index],0);
  if(!Number.isFinite(u)||!Number.isFinite(v)||Math.hypot(u,v)<=projection.radiusMM*0.08)
    throw new RangeError('Move the pointer away from the rotation pivot.');
  return Math.atan2(v,u);
}

export function unwrapRotationDelta(current:number,previous:number):number {
  if(!Number.isFinite(current)||!Number.isFinite(previous))throw new RangeError('Rotation angles must be finite.');
  let delta=current-previous;
  if(delta>Math.PI)delta-=Math.PI*2;
  if(delta< -Math.PI)delta+=Math.PI*2;
  return delta;
}

export function parseAngularStep(raw:string):number {
  if(typeof raw!=='string'||raw.length>128||!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))throw new RangeError('Enter an angle step from 0.001 to 180 degrees.');
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0.001||value>180)throw new RangeError('Enter an angle step from 0.001 to 180 degrees.');
  return value;
}

/** Continuous angle feedback uses the same camera, rather than rounding to a ring segment. */
export function rotationMarkerPoint(projection:RotationProjection,angleRadians:number):{x:number;y:number} {
  if(!Number.isFinite(angleRadians))throw new RangeError('A finite display angle is required.');
  const point=projection.pivotMM.map((value,index)=>(value+projection.radiusMM*(projection.basisU[index]*Math.cos(angleRadians)+projection.basisV[index]*Math.sin(angleRadians)))*projection.mmToSceneUnit);
  const view=projection.view;
  const x=view[0]*point[0]+view[4]*point[1]+view[8]*point[2]+view[12];
  const y=view[1]*point[0]+view[5]*point[1]+view[9]*point[2]+view[13];
  const depth=-(view[2]*point[0]+view[6]*point[1]+view[10]*point[2]+view[14]);
  if(!Number.isFinite(depth)||depth<=0)throw new RangeError('The rotation marker is behind the camera.');
  return{x:projection.widthCss*(1+projection.projectionX*x/depth)/2,y:projection.heightCss*(1-projection.projectionY*y/depth)/2};
}
