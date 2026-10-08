import { bakeMotionGltfAnimation, importMotionGltfAnimation, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const ids = ['stage', 'loading', 'status', 'time', 'source-keys', 'baked-keys', 'poses'];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

try {
  const base = './assets/gltf-interpolation-test/';
  const [documentResponse, binaryResponse] = await Promise.all([
    fetch(`${base}InterpolationTest.gltf`), fetch(`${base}InterpolationTest_data.bin`),
  ]);
  if (!documentResponse.ok || !binaryResponse.ok) throw new Error('glTF sample request failed');
  const gltf = await documentResponse.json();
  const binary = new Uint8Array(await binaryResponse.arrayBuffer());
  const options = {
    animationIndex: 4,
    contextId: 'interpolation-test',
    nodeTargets: [{ nodeIndex: 4, targetId: 'rotating-box' }],
    frame: 'gltf-y-up-as-part-xyz',
  };
  const clip = bakeMotionGltfAnimation(gltf, [binary], { ...options, subdivisionsPerInterval: 4 });
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: elements.stage, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1b29);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc8f4ff, 0x1a3f50, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-2, 3, 5);
  scene.add(light);
  const geometry = new THREE.BoxGeometry(1.6, 0.45, 0.6);
  const material = new THREE.MeshStandardMaterial({ color: 0x40d9c0, metalness: 0.25, roughness: 0.3 });
  const box = new THREE.Mesh(geometry, material);
  scene.add(box);
  let current;
  function seek(seconds) {
    current = sampleMotionClip(clip, seconds);
    const pose = current.poses[0];
    box.quaternion.set(...pose.rotation);
    renderer.render(scene, camera);
    elements.time.textContent = `${seconds.toFixed(3)} s`;
    elements.poses.textContent = JSON.stringify({
      targetId: pose.targetId,
      rotationXYZW: pose.rotation.map((number) => +number.toFixed(7)),
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
  elements['source-keys'].textContent = '5 CUBICSPLINE';
  elements['baked-keys'].textContent = `${clip.tracks[0].keys.length} SLERP`;
  seek(0);
  resize();
  elements.loading.hidden = true;
  elements.status.textContent = 'Cubic rotation baked into an owned v0 clip';
  document.body.dataset.ready = 'true';
  for (const [id, seconds] of [['start', 0], ['first-quarter', 0.125], ['middle', 1], ['end', 2]]) {
    document.getElementById(id).addEventListener('click', () => {
      seek(seconds);
      elements.status.textContent = `${id} accepted`;
    });
  }
  document.getElementById('invalid').addEventListener('click', () => {
    try {
      importMotionGltfAnimation(gltf, [binary], options);
      elements.status.textContent = 'Unexpected old API acceptance';
    } catch (error) {
      elements.status.textContent = `Old API refused: ${error.code}`;
    }
  });
  window.motionCubicDemo = { getState: () => current, getStatus: () => elements.status.textContent, seek };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Cubic scene unavailable: ${error.message}`;
  elements.status.textContent = `Load refused: ${error.message}`;
  console.error(error);
}
