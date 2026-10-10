import {prepareCamera,type MeshCamera} from '@barocss/gpu';
import type {CadEditorScaleAxis} from '../types.js';
import {projectCurvePole,type PolePoint} from './curve-pole-projection.js';
import {projectPoleAxis,axisPointerParameter,type PoleAxis,type PoleAxisProjection} from './pole-axis-projection.js';

export interface ScaleProjection {
  axis:CadEditorScaleAxis;
  pivotMM:PolePoint;
  xCss:number;yCss:number;dirX:number;dirY:number;handleX:number;handleY:number;
  axisProjection:PoleAxisProjection|null;
  baseline:number;
  widthCSS:number;heightCSS:number;pixelW:number;pixelH:number;
  camera:MeshCamera;mmScale:number;
}
const axisIndex=(axis:CadEditorScaleAxis):PoleAxis=>axis==='x'?0:axis==='y'?1:2;
function requireFactor(factor:number):void {
  if(!Number.isFinite(factor)||factor<.001||factor>100)throw new RangeError('Enter a scale factor from 0.001 to 100.');
}
function requireStep(step:number):void {
  if(!Number.isFinite(step)||step<.001||step>1)throw new RangeError('Enter a factor step from 0.001 to 1.');
}

/** A dimensionless scale handle uses the accepted pivot and actual public camera. */
export function prepareScaleProjection(pivotMM:PolePoint,camera:MeshCamera,mmScale:number,widthCSS:number,heightCSS:number,
  pixelW:number,pixelH:number,axis:CadEditorScaleAxis):ScaleProjection|null {
  if(!['uniform','x','y','z'].includes(axis))throw new RangeError('Choose All, X, Y or Z scale axes.');
  if(widthCSS<=0||heightCSS<=0||pixelW<=0||pixelH<=0)return null;
  const pivot=projectCurvePole(pivotMM,camera,mmScale,widthCSS,heightCSS,pixelW,pixelH);
  if(!pivot)return null;
  const projected=axis==='uniform'?null:projectPoleAxis(pivotMM,camera,mmScale,widthCSS,heightCSS,pixelW,pixelH,axisIndex(axis));
  if(axis!=='uniform'&&!projected)return null;
  const dirX=projected?.dirX??Math.SQRT1_2,dirY=projected?.dirY??-Math.SQRT1_2;
  const handleX=pivot.xCss+dirX*64,handleY=pivot.yCss+dirY*64;
  if(handleX<8||handleY<8||handleX>widthCSS-8||handleY>heightCSS-8)return null;
  const baseline=projected?axisPointerParameter(projected,handleX,handleY):64;
  if(!Number.isFinite(baseline)||baseline<=0)return null;
  return{axis,pivotMM:[...pivotMM],xCss:pivot.xCss,yCss:pivot.yCss,dirX,dirY,handleX,handleY,
    axisProjection:projected,baseline,widthCSS,heightCSS,pixelW,pixelH,camera:structuredClone(camera),mmScale};
}

/** Axis handles invert perspective; All uses the captured screen-diagonal ratio. */
export function scalePointerFactor(projection:ScaleProjection,startX:number,startY:number,currentX:number,currentY:number,
  snapStep:number|null):number {
  if(![startX,startY,currentX,currentY,projection.baseline].every(Number.isFinite)||projection.baseline<=0)
    throw new RangeError('A finite scale pointer and baseline are required.');
  const axis=projection.axisProjection;
  const delta=axis?axisPointerParameter(axis,currentX,currentY)-axisPointerParameter(axis,startX,startY)
    :(currentX-startX)*projection.dirX+(currentY-startY)*projection.dirY;
  let factor=1+delta/projection.baseline;
  requireFactor(factor);
  if(snapStep!==null){requireStep(snapStep);factor=1+Math.round((factor-1)/snapStep)*snapStep;}
  requireFactor(factor);
  return factor;
}

export function parseScaleStep(raw:string):number {
  if(typeof raw!=='string'||raw.length>128||!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))
    throw new RangeError('Enter a factor step from 0.001 to 1.');
  const value=Number(raw);requireStep(value);return value;
}

/** Pending feedback never evaluates or replaces the accepted native shape. */
export function scaleMarkerPoint(projection:ScaleProjection,factor:number):{x:number;y:number}|null {
  requireFactor(factor);
  if(projection.axis==='uniform'){
    const x=projection.xCss+projection.dirX*64*factor,y=projection.yCss+projection.dirY*64*factor;
    return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
  }
  const point:PolePoint=[...projection.pivotMM];point[axisIndex(projection.axis)]+=projection.baseline*factor;
  const {view,projection:matrix}=prepareCamera(projection.camera,projection.pixelW/projection.pixelH);
  const world=point.map(value=>value*projection.mmScale);
  const x=view[0]*world[0]+view[4]*world[1]+view[8]*world[2]+view[12];
  const y=view[1]*world[0]+view[5]*world[1]+view[9]*world[2]+view[13];
  const depth=-(view[2]*world[0]+view[6]*world[1]+view[10]*world[2]+view[14]);
  if(!Number.isFinite(depth)||depth<=0)return null;
  const marker={x:projection.widthCSS*(1+matrix[0]*x/depth)/2,y:projection.heightCSS*(1-matrix[5]*y/depth)/2};
  return Number.isFinite(marker.x)&&Number.isFinite(marker.y)?marker:null;
}
