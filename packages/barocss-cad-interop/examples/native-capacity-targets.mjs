import { options, same, sameBuffer, requireFact } from './native-capacity-common.mjs';
const width = 1200, height = 700;
const readPixels = gl => { const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return bytes; };
const trackDestroy = (objects, method) => objects.map(object => {
  const record = { object, count: 0 }; const original = object[method];
  object[method] = function (...args) { record.count++; return original.apply(this, args); };
  return record;
});
export async function makeTarget(target, host) {
  if (target === 'three') {
    const T = await import('three'); const { BaroCADLoader } = await import('../dist/three.js');
    const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(width, height); renderer.setClearColor(0x142236); host.append(renderer.domElement);
    const scene = new T.Scene(), marker = new T.Group(); scene.add(marker);
    const camera = new T.OrthographicCamera(-0.07, 0.07, 0.041, -0.041, 0.001, 0.5);
    camera.position.set(0, 0, 0.3); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    return {
      name: 'Three.js 0.186.1 WebGL2', gl: renderer.getContext(),
      parse: (source, config = options) => new BaroCADLoader(config).parse(source),
      attach(result, pose) { result.group.position.set(...pose); scene.add(result.group); },
      bind(result, neutral, native) {
        const mesh = result.group.children.find(x => x.name === native.id);
        requireFact(mesh && same(result.model, neutral.model), `Three native binding: ${native.id}`);
        if (native.kind === 'curve') {
          const preview = neutral.curves.find(x => x.curveId === native.id);
          requireFact(mesh.type === 'Line' && sameBuffer(mesh.geometry.getAttribute('position').array, preview.positions) &&
            mesh.userData.barocss.curveId === native.id && same(mesh.userData.barocss.nativeParameters, preview.sample.parameters), `Three curve buffers: ${native.id}`);
          mesh.material.color.setHex(0x28c9eb);
        } else {
          const preview = neutral.surfaces.find(x => x.surfaceId === native.id);
          requireFact(mesh.type === 'Mesh' && mesh.userData.surfaceId === native.id, `Three surface binding: ${native.id}`);
          for (const [name, values] of [['position', preview.mesh.positions], ['normal', preview.mesh.normals], ['_CAD_UV', preview.mesh.parameters]])
            requireFact(sameBuffer(mesh.geometry.getAttribute(name).array, values), `Three ${name}: ${native.id}`);
          requireFact(sameBuffer(mesh.geometry.getIndex().array, preview.mesh.indices), `Three indices: ${native.id}`);
        }
        const counters = [mesh.geometry, mesh.material].map((object, index) => { const record = { object, kind: index === 0 ? 'geometry' : 'material', count: 0 }; object.addEventListener('dispose', () => record.count++); return record; });
        return { mesh, counters };
      },
      visible: (mesh, value) => { mesh.visible = value; }, render: () => renderer.render(scene, camera),
      pixels: () => readPixels(renderer.getContext()), ready: async () => {},
      retained: result => scene.children.includes(result.group),
      released: result => !scene.children.includes(result.group),
      caller: () => scene.children.includes(marker) && renderer.getContext() instanceof WebGL2RenderingContext && host.contains(renderer.domElement),
    };
  }
  if (target === 'babylon') {
    const [{ Engine }, { Scene }, { Camera }, { FreeCamera }, { Mesh }, { LinesMesh }, { Color3, Color4 }, { Vector3 }, { HemisphericLight }, { BaroCADBabylonLoader }] = await Promise.all([
      import('@babylonjs/core/Engines/engine.js'), import('@babylonjs/core/scene.js'), import('@babylonjs/core/Cameras/camera.js'),
      import('@babylonjs/core/Cameras/freeCamera.js'), import('@babylonjs/core/Meshes/mesh.js'), import('@babylonjs/core/Meshes/linesMesh.js'),
      import('@babylonjs/core/Maths/math.color.js'), import('@babylonjs/core/Maths/math.vector.js'), import('@babylonjs/core/Lights/hemisphericLight.js'), import('../dist/babylon.js')]);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; host.append(canvas);
    const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(20 / 255, 34 / 255, 54 / 255, 1);
    const marker = new Mesh('caller-marker', scene), light = new HemisphericLight('caller-light', new Vector3(0, 0, 1), scene); light.intensity = 1.3;
    const camera = new FreeCamera('camera', new Vector3(0, 0, 0.3), scene); camera.upVector = new Vector3(0, 1, 0); camera.setTarget(Vector3.Zero());
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.orthoLeft = -0.07; camera.orthoRight = 0.07; camera.orthoTop = 0.041; camera.orthoBottom = -0.041; camera.minZ = 0.001; camera.maxZ = 0.5;
    scene.activeCamera = camera;
    return {
      name: 'Babylon.js 9.29.0 WebGL2', gl: canvas.getContext('webgl2'),
      parse: (source, config = options) => new BaroCADBabylonLoader(scene, config).parse(source),
      attach(result, pose) { for (const mesh of result.meshes) mesh.position.set(...pose); },
      bind(result, neutral, native) {
        const mesh = result.meshes.find(x => (x.metadata.barocss.curveId ?? x.metadata.barocss.surfaceId) === native.id);
        requireFact(mesh && same(result.model, neutral.model), `Babylon native binding: ${native.id}`);
        if (native.kind === 'curve') {
          const preview = neutral.curves.find(x => x.curveId === native.id);
          requireFact(mesh instanceof LinesMesh && sameBuffer(mesh.getVerticesData('position'), preview.positions) &&
            same(mesh.metadata.barocss.nativeParameters, preview.sample.parameters), `Babylon curve buffers: ${native.id}`);
          mesh.color = new Color3(0.16, 0.79, 0.92);
        } else {
          const preview = neutral.surfaces.find(x => x.surfaceId === native.id);
          requireFact(sameBuffer(mesh.getVerticesData('position'), preview.mesh.positions) && sameBuffer(mesh.getVerticesData('normal'), preview.mesh.normals) &&
            sameBuffer(mesh.getIndices(), preview.mesh.indices) && sameBuffer(mesh.metadata.barocss.nativeParameters, preview.mesh.parameters), `Babylon surface buffers: ${native.id}`);
        }
        const counters = [mesh, mesh.material].filter(Boolean).map((object, index) => { const record = { object, kind: index === 0 ? 'mesh' : 'material', count: 0 }; object.onDisposeObservable.add(() => record.count++); return record; });
        return { mesh, counters };
      },
      visible: (mesh, value) => mesh.setEnabled(value), render: () => scene.render(), pixels: () => readPixels(canvas.getContext('webgl2')),
      ready: () => scene.whenReadyAsync(), retained: result => result.meshes.every(x => scene.meshes.includes(x) && !x.isDisposed()),
      released: result => result.meshes.every(x => x.isDisposed() && !scene.meshes.includes(x)),
      caller: () => scene.meshes.includes(marker) && !marker.isDisposed() && scene.lights.includes(light) && !engine.isDisposed && host.contains(canvas),
    };
  }
  const [{ Application, DRAW_MODES, Graphics }, { Camera, Color }, { BaroCADPixi3DLoader }] = await Promise.all([import('pixi.js'), import('pixi3d/pixi7'), import('../dist/pixi3d.js')]);
  const app = new Application({ width, height, background: '#142236', antialias: false, preserveDrawingBuffer: true }); app.stop(); host.append(app.view);
  const marker = new Graphics(); app.stage.addChild(marker);
  const camera = Camera.main ?? new Camera(app.renderer); camera.orthographic = true; camera.orthographicSize = 0.082; camera.position.set(0, 0, 0.3);
  return {
    name: 'Pixi3D 2.5.0 / PixiJS 7.2.4 WebGL2', gl: app.view.getContext('webgl2'),
    parse: (source, config = options) => new BaroCADPixi3DLoader(config).parse(source),
    attach(result, pose) { result.root.position.set(...pose); app.stage.addChild(result.root); },
    bind(result, neutral, native) {
      const binding = native.kind === 'curve' ? result.renderedCurves.find(x => x.curveId === native.id) : result.renderedSurfaces.find(x => x.surfaceId === native.id);
      requireFact(binding && same(result.model, neutral.model), `Pixi native binding: ${native.id}`);
      const mesh = binding.mesh;
      if (native.kind === 'curve') {
        const preview = neutral.curves.find(x => x.curveId === native.id);
        requireFact(mesh.material.drawMode === DRAW_MODES.LINE_STRIP && sameBuffer(mesh.geometry.positions.buffer, preview.positions) &&
          same(binding.nativeParameters, preview.sample.parameters) && same(binding.nativeIntervals, preview.sample.segments.map(x => x.domain)) &&
          mesh.geometry.indices.buffer.length === preview.sample.pointsMM.length && mesh.geometry.indices.buffer.every((v, i) => v === i), `Pixi curve buffers: ${native.id}`);
      } else {
        const preview = neutral.surfaces.find(x => x.surfaceId === native.id), retained = result.surfaces.find(x => x.surfaceId === native.id);
        requireFact(sameBuffer(mesh.geometry.positions.buffer, preview.mesh.positions) && sameBuffer(mesh.geometry.normals.buffer, preview.mesh.normals) &&
          sameBuffer(mesh.geometry.indices.buffer, preview.mesh.indices) && sameBuffer(retained.mesh.parameters, preview.mesh.parameters), `Pixi surface buffers: ${native.id}`);
      }
      mesh.material.baseColor = new Color(0.16, 0.79, 0.92);
      return { mesh, counters: trackDestroy([mesh, mesh.geometry, mesh.material], 'destroy').map((record, index) => Object.assign(record, { kind: ['mesh', 'geometry', 'material'][index] })) };
    },
    visible: (mesh, value) => { mesh.visible = value; }, render: () => app.renderer.render(app.stage), pixels: () => readPixels(app.view.getContext('webgl2')), ready: async () => {},
    retained: result => app.stage.children.includes(result.root) && !result.root.destroyed,
    released: result => result.root.destroyed && !app.stage.children.includes(result.root),
    caller: () => app.stage.children.includes(marker) && !marker.destroyed && app.renderer.gl instanceof WebGL2RenderingContext && host.contains(app.view),
  };
}
