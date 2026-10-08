import { importMotionGltfAnimation, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const ids = ['stage', 'loading', 'status', 'clip-name', 'time', 'interpolation', 'poses'];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

try {
  const base = './assets/gltf-animated-triangle/';
  const documentResponse = await fetch(`${base}AnimatedTriangle.gltf`);
  if (!documentResponse.ok) throw new Error('glTF JSON request failed');
  const gltf = await documentResponse.json();
  const responses = await Promise.all(gltf.buffers.map(({ uri }) => fetch(`${base}${uri}`)));
  if (responses.some((response) => !response.ok)) throw new Error('glTF binary request failed');
  const buffers = await Promise.all(responses.map(async (response) => new Uint8Array(await response.arrayBuffer())));
  const options = {
    animationIndex: 0,
    contextId: 'animated-triangle',
    nodeTargets: [{ nodeIndex: 0, targetId: 'triangle' }],
    frame: 'gltf-y-up-as-part-xyz',
  };
  const clip = importMotionGltfAnimation(gltf, buffers, options);
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: elements.stage, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1b29);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc8f4ff, 0x1a3f50, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-2, 3, 4);
  scene.add(light);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.75, -0.55, 0, 0.75, -0.55, 0, 0, 0.85, 0,
  ], 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x40d9c0, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.35 });
  const triangle = new THREE.Mesh(geometry, material);
  scene.add(triangle);
  let current;
  function seek(seconds) {
    current = sampleMotionClip(clip, seconds);
    const pose = current.poses[0];
    triangle.quaternion.set(...pose.rotation);
    renderer.render(scene, camera);
    elements.time.textContent = `${seconds.toFixed(2)} s`;
    elements.poses.textContent = JSON.stringify({
      targetId: pose.targetId,
      rotationXYZW: pose.rotation.map((number) => +number.toFixed(6)),
    }, null, 2);
    return current;
  }
  function resize() {
    const width = elements.stage.clientWidth;
    const height = elements.stage.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (current) renderer.render(scene, camera);
  }
  window.addEventListener('resize', resize);
  elements['clip-name'].textContent = gltf.asset.generator || 'AnimatedTriangle';
  elements.interpolation.textContent = clip.tracks[0].interpolation;
  seek(0);
  resize();
  elements.loading.hidden = true;
  elements.status.textContent = 'glTF animation imported into one Motion clip';
  document.body.dataset.ready = 'true';
  for (const [id, seconds] of [['start', 0], ['quarter', 0.25], ['middle', 0.5], ['end', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
      seek(seconds);
      elements.status.textContent = `${id} accepted`;
    });
  }
  document.getElementById('invalid').addEventListener('click', () => {
    try {
      const unsupported = { ...gltf, animations: [{ ...gltf.animations[0],
        samplers: [{ ...gltf.animations[0].samplers[0], interpolation: 'CUBICSPLINE' }] }] };
      importMotionGltfAnimation(unsupported, buffers, options);
      elements.status.textContent = 'Unexpected CUBICSPLINE acceptance';
    } catch (error) {
      elements.status.textContent = `Import refused: ${error.code}`;
    }
  });
  window.motionGltfDemo = { getState: () => current, getStatus: () => elements.status.textContent, seek };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `glTF scene unavailable: ${error.message}`;
  elements.status.textContent = `Load refused: ${error.message}`;
  console.error(error);
}
