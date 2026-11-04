import { createViewer } from '@barocss/viewer';

// Primitive display proxies only. No native CAD provenance or physics input.
function boxPacket(id, half) {
  const positions = [], normals = [], parameters = [], indices = [];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const normal = [0, 0, 0]; normal[axis] = sign;
    const first = positions.length / 3;
    for (const [u, v] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      const point = [0, 0, 0]; point[axis] = sign * half[axis];
      point[(axis + 1) % 3] = u * half[(axis + 1) % 3];
      point[(axis + 2) % 3] = v * half[(axis + 2) % 3];
      positions.push(...point.map(x => x * 1000)); normals.push(...normal);
      parameters.push((u + 1) / 2, (v + 1) / 2);
    }
    indices.push(...(sign > 0 ? [first,first+1,first+2,first,first+2,first+3]
      : [first,first+2,first+1,first,first+3,first+2]));
  }
  return { version: 0, surfaceId: id, revision: 0, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-z-up', winding: 'ccw',
    positions, normals, parameters, indices,
    bounds: { min: half.map(x => -x * 1000), max: half.map(x => x * 1000) } };
}

function spherePacket(id, radius) {
  const positions=[],normals=[],parameters=[],indices=[],lat=16,lon=24;
  for(let j=0;j<=lat;j++)for(let i=0;i<=lon;i++){
    const a=Math.PI*j/lat,b=2*Math.PI*i/lon,n=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];
    positions.push(...n.map(v=>v*radius*1000));normals.push(...n);parameters.push(i/lon,j/lat);
  }
  for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){
    const a=j*(lon+1)+i,b=a+lon+1;
    if(j>0)indices.push(a,a+1,b);if(j<lat-1)indices.push(a+1,b+1,b);
  }
  return {version:0,surfaceId:id,revision:0,lengthUnit:'mm',coordinateSystem:'right-handed-z-up',winding:'ccw',positions,normals,parameters,indices,bounds:{min:[-radius*1000,-radius*1000,-radius*1000],max:[radius*1000,radius*1000,radius*1000]}};
}

export async function createDisplay(canvas, onError = () => {}) {
  const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001,
    background: [0.95,0.96,0.98], onDeviceEvent: event => {
      if (event.type === 'lost' || event.type === 'recovery-failed')
        onError(new Error(event.message ?? 'Viewer GPU device lost'));
    } });
  // Preserve the existing public Viewer limits. Scale both axes together.
  let surface = null;
  function resize() {
    const cssWidth = Math.max(1, canvas.clientWidth), cssHeight = Math.max(1, canvas.clientHeight);
    const devicePixelRatio = Number.isFinite(globalThis.devicePixelRatio) && globalThis.devicePixelRatio > 0
      ? globalThis.devicePixelRatio : 1;
    const requestedScale = Math.min(devicePixelRatio, 2);
    const scale = Math.min(requestedScale, 4096 / cssWidth, 4096 / cssHeight,
      Math.sqrt(4194304 / (cssWidth * cssHeight)));
    const pixelWidth = Math.max(1, Math.floor(cssWidth * scale));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * scale));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight)
      viewer.resize(pixelWidth, pixelHeight);
    surface = { cssWidth, cssHeight, pixelWidth, pixelHeight, devicePixelRatio,
      requestedScale, scale, maxPixels: 4194304, maxDimension: 4096 };
  }
  resize();
  const observer = new ResizeObserver(() => { try { resize(); } catch (error) { onError(error); } });
  observer.observe(canvas);
  const controls = viewer.attachPointerControls({ onError });
  let modelKey = null, packets = [], bindings = [], lastStep = null, camera = 0, cameraTarget=[0,1.2,0],cameraDistance=10;
  function setCamera() {
    viewer.setView({ eye: [cameraTarget[0]+(camera?-0.6:0.6)*cameraDistance,cameraTarget[1]+.4*cameraDistance,cameraTarget[2]+.8*cameraDistance], target: cameraTarget,
      up: [0,1,0], fovY: 40, near: 0.01, far: 100 });
  }
  setCamera();
  return {
    present(state, model) {
      const key = JSON.stringify(model);
      if (key !== modelKey) {
        if (!Array.isArray(model.bodies) || model.bodies.length < 1 || model.bodies.length > 4)
          throw new Error('Viewer primitive path requires 1–4 bodies');
        packets = model.bodies.map(body => {
          const collider = model.colliders.find(c => c.bodyId === body.id);
          const g=collider?.geometry;if(!g||!['box','sphere'].includes(g.kind))throw Error('Gallery proxy supports centered box/sphere only');
          return {modelId:'contact_lab',packet:g.kind==='box'?boxPacket(body.id,g.halfExtentsM):spherePacket(body.id,g.radiusM)};
        });
        bindings = model.bodies.map(body => ({ contextId: 'contact_lab', targetId: body.id,
          ref: { modelId: 'contact_lab', surfaceId: body.id } }));
        const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
        for(const body of model.bodies){const g=model.colliders.find(c=>c.bodyId===body.id).geometry,r=g.kind==='sphere'?g.radiusM:Math.hypot(...g.halfExtentsM);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],body.initial.positionM[k]-r);hi[k]=Math.max(hi[k],body.initial.positionM[k]+r);}}
        cameraTarget=lo.map((v,k)=>(v+hi[k])/2);cameraDistance=Math.max(1.6,...hi.map((v,k)=>v-lo[k]))*1.8;
        viewer.setPackets(packets); modelKey = key; camera = 0; setCamera();
      }
      if (state.bodies.length !== bindings.length || new Set(state.bodies.map(b => b.id)).size !== bindings.length)
        throw new Error('Accepted body population differs from the Viewer binding');
      viewer.applyMotionFrame({ contextId: 'contact_lab', timeSeconds: state.timeSeconds,
        poses: state.bodies.map(body => ({ targetId: body.id,
          translation: body.positionM.map(x => x * 1000),
          rotation: [...body.orientationXYZW], scale: [1,1,1] })) },
      bindings, { basis: 'part-xyz-matches-rhyup' });
      lastStep = state.stepIndex;
    },
    draw() { resize(); }, // Display density only; no physics or extra pose submission.
    async readPixels() {
      resize();
      const capturedSurface = { ...surface };
      const nativeWidth = canvas.width, nativeHeight = canvas.height;
      const raw = await viewer.readPixels();
      if (canvas.width !== nativeWidth || canvas.height !== nativeHeight
        || raw.length !== nativeWidth * nativeHeight * 4)
        throw new Error('Viewer surface changed during native GPU capture');
      // A bounded observer samples actual native GPU pixels. It never draws.
      const width = 640, height = 360, rgba = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const sx = Math.min(nativeWidth - 1, Math.floor((x + 0.5) * nativeWidth / width));
        const sy = Math.min(nativeHeight - 1, Math.floor((y + 0.5) * nativeHeight / height));
        const src = (sy * nativeWidth + sx) * 4, dst = (y * width + x) * 4;
        for (let k = 0; k < 4; k++) rgba[dst + k] = raw[src + k];
      }
      return { width, height, rgba, sourceFormat: 'rgba8', origin: 'top-left',
        sampling: 'nearest-center-native-gpu-pixels', nativeWidth, nativeHeight,
        nativeBytes: raw.length, surface: capturedSurface };
    },
    snapshot() {
      const state = viewer.getState();
      return { kind: '@barocss/viewer', bodyCount: state.surfaces.length,
        lastStep, surface: surface ? { ...surface } : null, frame: state.frame, sourceUnit: state.sourceUnit,
        mmToSceneUnit: state.mmToSceneUnit, motion: state.motion,
        surfaces: state.surfaces, camera: state.camera,
        packets: state.packets.map(entry => ({ modelId: entry.modelId,
          surfaceId: entry.packet.surfaceId, cornerMM: entry.packet.positions.slice(0,3) })),
        contactMarkers: 'NOT_SUPPORTED_BY_THIS_ADAPTER', nativeCadProvenance: false };
    },
    home() { camera = 1 - camera; setCamera(); },
    dispose() { observer.disconnect(); controls.dispose(); viewer.dispose(); },
  };
}
