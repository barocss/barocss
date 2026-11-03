import {createViewer} from '@barocss/viewer';
// Display-only triangle packets. They provide no original CAD/native boundary authority.
function makePacket(config) {
  const positions = [], normals = [], parameters = [], indices = [];
  const vertex = (point, normal, uv = [0, 0]) => {
    const index = positions.length / 3;
    positions.push(...point.map(value => value * 1000));
    normals.push(...normal); parameters.push(...uv);
    return index;
  };
  const triangle = (a, b, c) => {
    const p = index => positions.slice(index * 3, index * 3 + 3);
    const pa = p(a), pb = p(b), pc = p(c);
    const u = pb.map((value, axis) => value - pa[axis]);
    const v = pc.map((value, axis) => value - pa[axis]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const dot = cross.reduce((sum, value, axis) => sum + value * normals[a * 3 + axis], 0);
    if (!Number.isFinite(dot) || dot === 0) throw new Error('Display proxy has a degenerate triangle');
    indices.push(...(dot > 0 ? [a, b, c] : [a, c, b]));
  };
  if (config.shape === 'box') {
    const half = config.halfExtentsM;
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const normal = [0, 0, 0]; normal[axis] = sign;
      const face = [];
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const point = [0, 0, 0]; point[axis] = sign * half[axis];
        point[(axis + 1) % 3] = u * half[(axis + 1) % 3];
        point[(axis + 2) % 3] = v * half[(axis + 2) % 3];
        face.push(vertex(point, normal, [(u + 1) / 2, (v + 1) / 2]));
      }
      triangle(face[0], face[1], face[2]); triangle(face[0], face[2], face[3]);
    }
  }
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let index = 0; index < positions.length; index++) {
    const axis = index % 3;
    bounds.min[axis] = Math.min(bounds.min[axis], positions[index]);
    bounds.max[axis] = Math.max(bounds.max[axis], positions[index]);
  }
  return { version: 0, surfaceId: config.surfaceId, revision: 0, lengthUnit: 'mm',
    // Required PreviewPacket metadata. Viewer motion explicitly admits the matching Y-up XYZ basis below.
    coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, parameters, indices, bounds };
}


const BODY=['z-cube','a-floor'],SURFACES=['warm_cube_display','warm_floor_display','warm_contact_annotation'],CTX='warm_viewer';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),unit=a=>a.map(v=>v/Math.hypot(...a));
function markerPacket(){const positions=[],normals=[],parameters=[],indices=[],r=8;for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const face=[],u=(axis+1)%3,v=(axis+2)%3;for(const[a,b]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[0,0,0],n=[0,0,0];p[u]=a*r;p[v]=b*sign*r;n[axis]=sign;face.push(positions.length/3);positions.push(...p);normals.push(...n);parameters.push(0,0);}indices.push(face[0],face[1],face[2],face[0],face[2],face[3]);}return{version:0,surfaceId:SURFACES[2],revision:0,lengthUnit:'mm',coordinateSystem:'right-handed-z-up',winding:'ccw',positions,normals,parameters,indices,bounds:{min:[-r,-r,-r],max:[r,r,r]}};}
function rotate(q,p){const[x,y,z,w]=q,[a,b,c]=p;return[(1-2*(y*y+z*z))*a+2*(x*y-z*w)*b+2*(x*z+y*w)*c,2*(x*y+z*w)*a+(1-2*(x*x+z*z))*b+2*(y*z-x*w)*c,2*(x*z-y*w)*a+2*(y*z+x*w)*b+(1-2*(x*x+y*y))*c];}
export async function createDisplay(canvas,model,onError,{detail=false}={}){
 const viewer=await createViewer(canvas,{mmToSceneUnit:.001,background:[.96,.965,.95],onDeviceEvent:e=>{if(e.type==='lost'||e.type==='recovery-failed')onError?.(Error(e.message??'GPU device lost'));}}),pointer=viewer.attachPointerControls({onError}),ids=[...BODY,'contact0'];
 const packets=BODY.map((id,i)=>({modelId:id,packet:makePacket({shape:'box',surfaceId:SURFACES[i],halfExtentsM:model.colliders.find(c=>c.bodyId===id).geometry.halfExtentsM})}));packets.push({modelId:'contact0',packet:markerPacket()});viewer.setPackets(packets);const bindings=ids.map((id,i)=>({contextId:CTX,targetId:id,ref:{modelId:id,surfaceId:SURFACES[i]}}));let last=null,markersVisible=true,presented=null,visibleCount=-1;
 function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);viewer.resize(Math.max(1,Math.min(2048,Math.round(r.width*d))),Math.max(1,Math.min(2048,Math.round(r.height*d))));}
 function home(){viewer.setView(detail?{eye:[-.6,-.08,.38],target:[-.2,.005,.05],up:[0,1,0],fovY:24,near:.001,far:20}:{eye:[-1.9,.65,2.1],target:[0,.35,0],up:[0,1,0],fovY:35,near:.001,far:20});}
 function projectWorld(pointM){const camera=viewer.getState().camera,back=unit(sub(camera.eye,camera.target)),forward=back.map(x=>-x),right=unit(cross(camera.up,back)),up=cross(back,right),offset=sub(pointM,camera.eye),depth=dot(offset,forward),r=canvas.getBoundingClientRect(),tan=Math.tan(camera.fovY*Math.PI/360),x=dot(offset,right)/(depth*tan*canvas.width/canvas.height),y=dot(offset,up)/(depth*tan);return{xCss:r.width*(1+x)/2,yCss:r.height*(1-y)/2,depthScene:depth,occlusion:'not-tested',worldM:[...pointM],projectionAuthority:'host camera calculation; real GPU pixels checked separately'};}
 function present(state,key){const points=state.contacts.flatMap(c=>c.points.map(p=>({...structuredClone(p),bodyAId:c.bodyAId,bodyBId:c.bodyBId})));if(points.length>1)throw Error('Finite qualified warm display expects at most one actual native contact point');const count=markersVisible?points.length:0;if(count!==visibleCount){viewer.setVisibleGeometry(packets.filter((p,i)=>i<2||count).map(p=>({kind:'surface',modelId:p.modelId,surfaceId:p.packet.surfaceId})));visibleCount=count;}const poses=BODY.map(id=>{const b=state.bodies.find(b=>b.id===id);return{targetId:id,translation:b.positionM.map(x=>x*1000),rotation:[...b.orientationXYZW],scale:[1,1,1]};});poses.push({targetId:'contact0',translation:(points[0]?.anchorM??[0,0,0]).map(x=>x*1000),rotation:[0,0,0,1],scale:[1,1,1]});const frame={contextId:CTX,timeSeconds:state.timeSeconds,poses};viewer.applyMotionFrame(frame,bindings,{basis:'part-xyz-matches-rhyup'});last={key,stepIndex:state.stepIndex,frame:structuredClone(frame),points};presented=structuredClone(state);canvas.dataset.step=String(state.stepIndex);}
 resize();home();return{present,home,resize,readPixels:()=>viewer.readPixels(),toggleMarkers(){markersVisible=!markersVisible;if(presented)present(presented,last.key);return markersVisible;},snapshot(){const state=viewer.getState(),meshProjections=state.packets.slice(0,2).map(entry=>{const pose=state.motion?.displayPoses.find(p=>p.ref.modelId===entry.modelId&&p.ref.surfaceId===entry.packet.surfaceId);if(!pose)return null;const localPointMM=entry.packet.positions.slice(0,3),rot=rotate(pose.rotationXYZW,localPointMM.map(x=>x*.001)),world=rot.map((x,i)=>x+pose.translation[i]*.001);return{targetId:entry.modelId,surfaceId:entry.packet.surfaceId,localPointMM,actualViewerDisplayPose:pose,projection:projectWorld(world)};}).filter(Boolean);return{state,lastPresented:structuredClone(last),markersVisible,meshProjections,contactProjections:(last?.points??[]).map(p=>({id:p.id,...projectWorld(p.anchorM)})),geometryProvenance:'display-only triangles from exact collider dimensions; no original CAD nativeSurface claim'};},dispose(){pointer.dispose();viewer.dispose();}};
}
