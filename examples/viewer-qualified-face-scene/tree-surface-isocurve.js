import {extractSurfaceIsoCurve} from '@barocss/cad';
import {queryQualifiedFaceTreeNode} from './qualified-face-tree.js';

/** Native parameter Curve inspection from one current original Surface; no Viewer state or GPU mutation. */
export function queryQualifiedTreeSurfaceIsoCurve(viewer,ref,fixedAxis,parameter){
  if(typeof fixedAxis!=='string'||(fixedAxis!=='u'&&fixedAxis!=='v'))
    throw new RangeError('Qualified Face tree Surface iso-Curve: fixedAxis must be exactly u or v');
  if(typeof parameter!=='number'||!Number.isFinite(parameter))
    throw new RangeError('Qualified Face tree Surface iso-Curve: parameter must be a finite original number');
  const node=queryQualifiedFaceTreeNode(viewer,ref);
  if(node.ref.kind!=='surface')
    throw new RangeError('Qualified Face tree Surface iso-Curve: selected node must be an original Surface');
  const originalIds=new Set(node.ref.expectedFace.geometry.objects.map(geometry=>geometry.id));
  const curveId=Array.from({length:6},(_,index)=>'viewer_iso_'+index).find(id=>!originalIds.has(id));
  if(!curveId)throw new RangeError('Qualified Face tree Surface iso-Curve: no unused inspection Curve ID');
  const measurement=extractSurfaceIsoCurve(node.properties.geometry,{fixedAxis,parameter,curveId});
  return structuredClone({version:0,node,measurement});
}
