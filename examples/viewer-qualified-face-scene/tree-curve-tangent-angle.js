import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {queryQualifiedFaceTangentAngle} from './tangent-angle.js';

/** Unsigned original tangent angle at two declared native parameters of current qualified Curve nodes. */
export function queryQualifiedTreeTangentAngle(viewer,firstRef,firstT,secondRef,secondT){
  const firstNode=queryQualifiedFaceTreeNode(viewer,firstRef);
  const secondNode=queryQualifiedFaceTreeNode(viewer,secondRef);
  if(firstNode.ref.kind!=='curve'||secondNode.ref.kind!=='curve')
    throw new RangeError('Qualified Face tree tangent angle: both nodes must be original Curves');
  if(typeof firstT!=='number'||!Number.isFinite(firstT))
    throw new RangeError('Qualified Face tree tangent angle: first t must be a finite original parameter');
  if(typeof secondT!=='number'||!Number.isFinite(secondT))
    throw new RangeError('Qualified Face tree tangent angle: second t must be a finite original parameter');
  const pin=(node,t)=>({sourceId:node.ref.sourceId,expectedSource:node.ref.expectedSource,faceId:node.ref.faceId,
    modelId:node.ref.modelId,curveId:node.ref.geometryId,t});
  const measurement=queryQualifiedFaceTangentAngle(viewer.getState().qualifiedFaceScene,
    pin(firstNode,firstT),pin(secondNode,secondT));
  return structuredClone({version:0,first:{node:firstNode,t:firstT},second:{node:secondNode,t:secondT},measurement});
}
