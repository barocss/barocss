// Concatenate only actual native596 packets. This is a display mesh, not native topology.
export function circleFeatureDisplay(native,revision,quality,cad,gpu){
 if(!Number.isInteger(quality)||quality<2||quality>15)throw Error('Display sampling must be an integer2–15.');
 const active=native.features.filter(feature=>feature.status==='active');
 if(!active.length)return{packet:null,overlay:null,features:[],faces:[],edgeLineage:[]};
 const packet={version:0,surfaceId:'display_'+native.document.id,revision,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',positions:[],normals:[],indices:[],parameters:[],bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
 const features=[],faces=[],paths=[],edgeLineage=[],pathIds=new Set();
 const nativeIds=new Set();function collect(data){if(Array.isArray(data))data.forEach(collect);else if(data&&typeof data==='object')for(const[key,value]of Object.entries(data)){if((key==='id'||key==='name')&&typeof value==='string')nativeIds.add(value);collect(value);}}collect(native);if(nativeIds.has(packet.surfaceId))throw Error('Combined display ID collides with original native data');
 for(const feature of active){
  const preview=cad.tessellateXYCirclePrismShell(feature.evaluation.shell.bundle,{meshId:'display_'+feature.shellId,revision,segmentsPerQuarter:quality});
  if(nativeIds.has(preview.packet.surfaceId))throw Error('Local display ID collides with original native data');
  const p=gpu.validatePreviewPacket(preview.packet),vertexStart=packet.positions.length/3,indexStart=packet.indices.length;
  packet.positions.push(...p.positions);packet.normals.push(...p.normals);packet.parameters.push(...p.parameters);packet.indices.push(...p.indices.map(index=>index+vertexStart));
  features.push({featureId:feature.featureId,shellId:feature.shellId,profileId:feature.profileId,bindings:structuredClone(feature.bindings),projectionDocument:structuredClone(feature.evaluation.document),source:feature.evaluation.shell.profile.source,vertexRange:[vertexStart,packet.positions.length/3],indexRange:[indexStart,packet.indices.length],localPreview:preview});
  for(const range of preview.faceRanges)faces.push({featureId:feature.featureId,shellId:feature.shellId,faceId:range.faceId,surfaceId:range.surfaceId,role:range.role,vertexRange:range.vertexRange.map(index=>index+vertexStart),indexRange:range.indexRange.map(index=>index+indexStart),nativeRange:structuredClone(range)});
  for(const path of preview.edgePaths){if(pathIds.has(path.id))throw Error('Original native edge ID collision: '+path.id);pathIds.add(path.id);paths.push(structuredClone(path));}
  edgeLineage.push({featureId:feature.featureId,shellId:feature.shellId,edges:structuredClone(preview.edgeProvenance)});
 }
 for(let i=0;i<packet.positions.length;i++){const axis=i%3;packet.bounds.min[axis]=Math.min(packet.bounds.min[axis],packet.positions[i]);packet.bounds.max[axis]=Math.max(packet.bounds.max[axis],packet.positions[i]);}
 cad.validatePreviewPacket(packet);const owned=gpu.validatePreviewPacket(packet);
 return{packet:owned,overlay:{version:0,packet:structuredClone(owned),paths,color:[.06,.085,.11]},features,faces,edgeLineage};
}
