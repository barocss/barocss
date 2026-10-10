import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {queryQualifiedFaceSurfaceCurvature} from './surface-curvature.js';

/** Original local curvature at declared native U/V parameters of a current qualified Surface tree node. */
export function queryQualifiedTreeSurfaceCurvature(viewer,ref,u,v){
  const node=queryQualifiedFaceTreeNode(viewer,ref);
  if(node.ref.kind!=='surface')throw new RangeError('Qualified Face tree Surface curvature: selected node must be an original Surface');
  if(typeof u!=='number'||!Number.isFinite(u))throw new RangeError('Qualified Face tree Surface curvature: u must be a finite original parameter');
  if(typeof v!=='number'||!Number.isFinite(v))throw new RangeError('Qualified Face tree Surface curvature: v must be a finite original parameter');
  const pin={sourceId:node.ref.sourceId,expectedSource:node.ref.expectedSource,faceId:node.ref.faceId,
    modelId:node.ref.modelId,surfaceId:node.ref.geometryId,u,v};
  const measurement=queryQualifiedFaceSurfaceCurvature(viewer.getState().qualifiedFaceScene,pin);
  return structuredClone({version:0,node,measurement});
}
