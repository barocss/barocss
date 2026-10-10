import { prepareCamera, type MeshCamera } from '@barocss/gpu';

export type PolePoint = [number,number,number];
export interface CurvePolePlane {
  originMM: PolePoint;
  xCss:number;yCss:number;
  right:PolePoint;up:PolePoint;
  mmPerCssX:number;mmPerCssY:number;
}
/** Display-only mapping of original coefficients through the actual public camera matrices.
 * This does not evaluate a Curve or infer native control points from sampled vertices.
 */
export function projectCurvePole(pointMM:PolePoint,camera:MeshCamera,mmToSceneUnit:number,
  cssWidth:number,cssHeight:number,pixelWidth:number,pixelHeight:number):CurvePolePlane|null {
  if(![...pointMM,mmToSceneUnit,cssWidth,cssHeight,pixelWidth,pixelHeight].every(Number.isFinite)
    || mmToSceneUnit<=0||cssWidth<=0||cssHeight<=0||pixelWidth<=0||pixelHeight<=0)throw new RangeError('A finite visible point and camera size are required.');
  const {view,projection}=prepareCamera(camera,pixelWidth/pixelHeight);
  const p=pointMM.map(value=>value*mmToSceneUnit);
  const x=view[0]*p[0]+view[4]*p[1]+view[8]*p[2]+view[12];
  const y=view[1]*p[0]+view[5]*p[1]+view[9]*p[2]+view[13];
  const z=view[2]*p[0]+view[6]*p[1]+view[10]*p[2]+view[14];
  const depth=-z,ndcX=projection[0]*x/depth,ndcY=projection[5]*y/depth;
  const ndcZ=(projection[10]*z+projection[14])/depth;
  if(depth<=0||!Number.isFinite(ndcX)||!Number.isFinite(ndcY)||ndcZ< -1||ndcZ>1||Math.abs(ndcX)>1||Math.abs(ndcY)>1)return null;
  return {originMM:[...pointMM],xCss:cssWidth*(1+ndcX)/2,yCss:cssHeight*(1-ndcY)/2,
    right:[view[0],view[4],view[8]],up:[view[1],view[5],view[9]],
    mmPerCssX:2*depth/(cssWidth*projection[0]*mmToSceneUnit),mmPerCssY:2*depth/(cssHeight*projection[5]*mmToSceneUnit)};
}
/** Pointer translation in the camera-facing plane through the original authored point. */
export function moveCurvePoleInViewPlane(plane:CurvePolePlane,dxCss:number,dyCss:number):PolePoint {
  if(!Number.isFinite(dxCss)||!Number.isFinite(dyCss))throw new RangeError('Pointer movement must be finite.');
  if(dxCss===0&&dyCss===0)return [...plane.originMM]; // Preserve original signed-zero bits on no movement.
  const result=plane.originMM.map((value,index)=>{const delta=plane.right[index]*dxCss*plane.mmPerCssX-plane.up[index]*dyCss*plane.mmPerCssY;return delta===0?value:value+delta;}) as PolePoint;
  if(!result.every(Number.isFinite))throw new RangeError('The moved control point is not finite.');
  return result;
}
