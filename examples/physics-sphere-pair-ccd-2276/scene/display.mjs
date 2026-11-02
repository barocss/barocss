import { createViewer } from '@barocss/viewer';

// These triangles are display proxies. They are not native CAD geometry or physics input.
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
  } else {
    const radius = config.radiusM, half = config.shape === 'capsule' ? config.halfLengthM : 0;
    const segments = 32, bands = 16, rings = [];
    const top = vertex([0, half + radius, 0], [0, 1, 0], [.5, 0]);
    const rows = [];
    for (let band = 1; band < bands; band++) {
      const angle = band * Math.PI / bands;
      if (band === bands / 2 && half > 0) {
        rows.push({ angle, offset: half }, { angle, offset: -half });
      } else rows.push({ angle, offset: band <= bands / 2 ? half : -half });
    }
    for (const { angle, offset } of rows) {
      const ring = [];
      for (let segment = 0; segment < segments; segment++) {
        const azimuth = segment * 2 * Math.PI / segments;
        const normal = [Math.sin(angle) * Math.cos(azimuth), Math.cos(angle), Math.sin(angle) * Math.sin(azimuth)];
        ring.push(vertex([radius * normal[0], offset + radius * normal[1], radius * normal[2]], normal,
          [segment / segments, angle / Math.PI]));
      }
      rings.push(ring);
    }
    const bottom = vertex([0, -half - radius, 0], [0, -1, 0], [.5, 1]);
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      triangle(top, rings[0][segment], rings[0][next]);
      for (let row = 0; row < rings.length - 1; row++) {
        const a = rings[row], b = rings[row + 1];
        triangle(a[segment], b[segment], b[next]); triangle(a[segment], b[next], a[next]);
      }
      const last = rings.at(-1);
      triangle(last[segment], bottom, last[next]);
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

export async function createSpherePairDisplay(canvas,{onError}={}){
 const viewer=await createViewer(canvas,{mmToSceneUnit:.001,background:[.96,.965,.95],onDeviceEvent:e=>{if(e.type==='lost'||e.type==='recovery-failed')onError?.(new Error(e.message??'WebGPU device lost'));}});
 const controls=viewer.attachPointerControls({onError});const ids=['marked','other'],surfaceIds=['pair-marked-sphere-proxy','pair-other-sphere-proxy'];
 const bindings=ids.map((id,i)=>({contextId:'sphere_pair_ccd',targetId:id,ref:{modelId:id,surfaceId:surfaceIds[i]}}));let scenario=null,lastPresented=null;
 function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,globalThis.devicePixelRatio||1);viewer.resize(Math.max(1,Math.min(2048,Math.round(rect.width*ratio))),Math.max(1,Math.min(2048,Math.round(rect.height*ratio))));}
 function home(){if(!scenario)return;const span=Math.max(...scenario.starts.map(p=>Math.abs(p[0])))+Math.max(...scenario.radii)*scenario.displayRadiusScale;
 const aspect=canvas.width/canvas.height,distance=span*1.25/Math.tan(20*Math.PI/180)/Math.min(1,aspect),target=[0,scenario.starts[0][1]/2,0];viewer.setView({eye:[0,target[1]+distance*.13,distance],target,up:[0,1,0],fovY:40,near:.001,far:Math.max(100,distance*4)});}
 resize();return{
 configure(s){scenario=structuredClone(s);viewer.setPackets(ids.map((id,i)=>({modelId:id,packet:makePacket({shape:'sphere',radiusM:s.radii[i]*s.displayRadiusScale,surfaceId:surfaceIds[i]})})));lastPresented=null;canvas.dataset.proxyProvenance='display-only; radius scale '+s.displayRadiusScale+'; accepted centers unchanged';home();},
 present(state){const frame={contextId:'sphere_pair_ccd',timeSeconds:state.timeSeconds,poses:ids.map(id=>{const b=state.bodies.find(b=>b.id===id);if(!b)throw Error('Missing accepted body: '+id);return{targetId:id,translation:b.positionM.map(v=>v*1000),rotation:[...b.orientationXYZW],scale:[1,1,1]};})};viewer.applyMotionFrame(frame,bindings,{basis:'part-xyz-matches-rhyup'});lastPresented={stepIndex:state.stepIndex,frame:structuredClone(frame)};canvas.dataset.drawState='accepted';canvas.dataset.stepIndex=String(state.stepIndex);},
 resize,home,getState:()=>viewer.getState(),readPixels:()=>viewer.readPixels(),get lastPresented(){return structuredClone(lastPresented);},dispose(){controls.dispose();viewer.dispose();}
 };
}
