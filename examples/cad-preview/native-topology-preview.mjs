// Display candidates come from actual native Surface/Curve/topology consumers.
export function prepareNativeTopologyPreview(kind, cad, gpu) {
  let native;
  if (kind === 'native-shell') {
    const authoring = cad.buildXYPolygonRegion({id:'gallery_native_L_profile',points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]});
    const shell = cad.buildXYPolygonPrismShell(authoring.curve,{bodyId:'gallery_native_L_body',distanceMM:6});
    const preview = cad.tessellateXYPolygonPrismShell(shell.shell,{meshId:'gallery_native_L_mesh',revision:1});
    native = {authoring,shell,preview};
  } else if (kind === 'native-hole' || kind === 'native-hole-shell') {
    const outer = cad.buildXYPolygonRegion({id:'gallery_hole_outer',points:[[0,0],[10,0],[10,10],[0,10]]});
    const hole = cad.buildXYPolygonRegion({id:'gallery_hole_inner',points:[[3,3],[7,3],[7,7],[3,7]]});
    const face = cad.buildXYPolygonPlanarFaceWithHole(outer.curve,hole.curve,{faceId:'gallery_hole_face'});
    if(kind === 'native-hole-shell'){
      const shell = cad.buildXYPolygonPrismShellWithHole(face.bundle,{bodyId:'gallery_hole_body',distanceMM:6});
      const preview = cad.tessellateXYPolygonPrismShellWithHole(shell.shell,{meshId:'gallery_hole_body_mesh',revision:1});
      native = {authoring:{outer,hole},face,shell,preview};
    } else {
      const preview = cad.tessellateXYPolygonPlanarFaceWithHole(face.bundle,{meshId:'gallery_hole_mesh',revision:1});
      native = {authoring:{outer,hole},face,preview};
    }
  } else throw new RangeError('Unsupported native topology example');
  const packet = gpu.validatePreviewPacket(native.preview.packet);
  const extents = packet.bounds.max.map((value,i)=>value-packet.bounds.min[i]);
  const scale = 3/Math.max(...extents);
  const options = {mmToSceneUnit:scale,translate:packet.bounds.min.map((value,i)=>-(value+extents[i]/2)*scale),
    color:kind==='native-hole'?[.3,.76,.69]:[.82,.55,.36],background:[16/255,24/255,32/255],
    camera:{eye:kind==='native-hole'?[0,0,6]:kind==='native-hole-shell'?[3,2.5,8]:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}};
  const overlay = {version:0,packet:structuredClone(packet),paths:structuredClone(native.preview.edgePaths),color:[.06,.085,.11]};
  return {native,packet,options,overlay};
}
