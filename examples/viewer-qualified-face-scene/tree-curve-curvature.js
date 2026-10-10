import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {queryQualifiedFaceCurveCurvature} from './curve-curvature.js';

/** Original local curvature at one declared native parameter of a current qualified Curve tree node. */
export function queryQualifiedTreeCurveCurvature(viewer,ref,t){
  const node=queryQualifiedFaceTreeNode(viewer,ref);
  if(node.ref.kind!=='curve')throw new RangeError('Qualified Face tree Curve curvature: selected node must be an original Curve');
  if(typeof t!=='number'||!Number.isFinite(t))throw new RangeError('Qualified Face tree Curve curvature: t must be a finite original parameter');
  const pin={sourceId:node.ref.sourceId,expectedSource:node.ref.expectedSource,faceId:node.ref.faceId,
    modelId:node.ref.modelId,curveId:node.ref.geometryId,t};
  const measurement=queryQualifiedFaceCurveCurvature(viewer.getState().qualifiedFaceScene,pin);
  return structuredClone({version:0,node,measurement});
}
