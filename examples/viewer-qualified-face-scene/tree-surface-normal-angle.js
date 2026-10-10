import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {queryQualifiedFaceNormalAngle} from './normal-angle.js';

/** Unsigned original parameter-normal angle at two declared U/V pairs of current qualified Surface nodes. */
export function queryQualifiedTreeNormalAngle(viewer,firstRef,firstU,firstV,secondRef,secondU,secondV){
  const firstNode=queryQualifiedFaceTreeNode(viewer,firstRef);
  const secondNode=queryQualifiedFaceTreeNode(viewer,secondRef);
  if(firstNode.ref.kind!=='surface'||secondNode.ref.kind!=='surface')
    throw new RangeError('Qualified Face tree normal angle: both nodes must be original Surfaces');
  for(const [name,value] of [['first u',firstU],['first v',firstV],['second u',secondU],['second v',secondV]]){
    if(typeof value!=='number'||!Number.isFinite(value))
      throw new RangeError('Qualified Face tree normal angle: '+name+' must be a finite original parameter');
  }
  const pin=(node,u,v)=>({sourceId:node.ref.sourceId,expectedSource:node.ref.expectedSource,faceId:node.ref.faceId,
    modelId:node.ref.modelId,surfaceId:node.ref.geometryId,u,v});
  const measurement=queryQualifiedFaceNormalAngle(viewer.getState().qualifiedFaceScene,
    pin(firstNode,firstU,firstV),pin(secondNode,secondU,secondV));
  return structuredClone({version:0,first:{node:firstNode,u:firstU,v:firstV},
    second:{node:secondNode,u:secondU,v:secondV},measurement});
}
