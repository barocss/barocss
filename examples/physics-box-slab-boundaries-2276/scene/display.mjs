import { createViewer } from '@barocss/viewer';
const MOVING_ID='moving',OTHER_ID='fixture';

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

export async function createBoxSlabDisplay(canvas,{onError}={}) {
  const viewer=await createViewer(canvas,{mmToSceneUnit:.001,background:[.96,.965,.95],onDeviceEvent:event=>{
    if(event.type==='lost'||event.type==='recovery-failed')onError?.(new Error(event.message??'WebGPU device lost'));
  }});
  const controls=viewer.attachPointerControls({onError});
  const ids=[MOVING_ID,OTHER_ID], surfaceIds=['slab-moving-box-proxy','slab-static-box-proxy'];
  const bindings=ids.map((id,i)=>({contextId:'box_slab',targetId:id,ref:{modelId:id,surfaceId:surfaceIds[i]}}));
  let lastPresented=null;
  function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,globalThis.devicePixelRatio||1);viewer.resize(Math.max(1,Math.min(2048,Math.round(rect.width*ratio))),Math.max(1,Math.min(2048,Math.round(rect.height*ratio))));}
  function home(){viewer.setView({eye:[5,4.5,7],target:[.75,1,0],up:[0,1,0],fovY:40,near:.001,far:100});}
  resize();
  return {
    configure(scenario){viewer.setPackets(ids.map((id,i)=>({modelId:id,packet:makePacket({shape:'box',surfaceId:surfaceIds[i],halfExtentsM:i?scenario.otherHalfExtentsM:scenario.halfExtentsM})})));lastPresented=null;canvas.dataset.proxyProvenance='display-only; no native CAD provenance';home();},
    present(state){const frame={contextId:'box_slab',timeSeconds:state.timeSeconds,poses:ids.map(id=>{
      const body=state.bodies.find(b=>b.id===id);if(!body)throw Error('Accepted body missing: '+id);
      return {targetId:id,translation:body.positionM.map(v=>v*1000),rotation:[...body.orientationXYZW],scale:[1,1,1]};
    })};viewer.applyMotionFrame(frame,bindings,{basis:'part-xyz-matches-rhyup'});lastPresented={stepIndex:state.stepIndex,frame:structuredClone(frame)};canvas.dataset.drawState='accepted';canvas.dataset.stepIndex=String(state.stepIndex);},
    resize,home,getState:()=>viewer.getState(),readPixels:()=>viewer.readPixels(),get lastPresented(){return structuredClone(lastPresented);},
    dispose(){controls.dispose();viewer.dispose();}
  };
}
