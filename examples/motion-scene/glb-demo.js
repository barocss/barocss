import { importMotionGlbAnimation, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const ids = ['stage', 'loading', 'status', 'time', 'rotation-time', 'translation-time', 'poses'];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

try {
  const response = await fetch('./assets/gltf-box-animated/BoxAnimated.glb');
  if (!response.ok) throw new Error('GLB request failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const clip = importMotionGlbAnimation(bytes, {
    animationIndex: 0,
    contextId: 'box-animated',
    nodeTargets: [{ nodeIndex: 2, targetId: 'rotating-box' }, { nodeIndex: 0, targetId: 'moving-box' }],
    frame: 'gltf-y-up-as-part-xyz',
  });
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: elements.stage, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1b29);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.2, 7);
  camera.lookAt(0, 1.1, 0);
  scene.add(new THREE.HemisphereLight(0xc8f4ff, 0x1a3f50, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-2, 4, 5);
  scene.add(light);
  const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const rotationMaterial = new THREE.MeshStandardMaterial({ color: 0x40d9c0, metalness: 0.25, roughness: 0.3 });
  const translationMaterial = new THREE.MeshStandardMaterial({ color: 0xffad59, metalness: 0.2, roughness: 0.35 });
  const rotatingBox = new THREE.Mesh(geometry, rotationMaterial);
  const movingBox = new THREE.Mesh(geometry, translationMaterial);
  rotatingBox.position.x = -1.2;
  movingBox.position.x = 1.2;
  scene.add(rotatingBox, movingBox);
  const floor = new THREE.GridHelper(5, 10, 0x235267, 0x193b4d);
  floor.position.y = -0.65;
  scene.add(floor);
  let current;
  function seek(seconds) {
    current = sampleMotionClip(clip, seconds);
    const rotation = current.poses.find((pose) => pose.targetId === 'rotating-box');
    const translation = current.poses.find((pose) => pose.targetId === 'moving-box');
    rotatingBox.quaternion.set(...rotation.rotation);
    movingBox.position.set(1.2 + translation.translation[0] / 1000,
      translation.translation[1] / 1000, translation.translation[2] / 1000);
    renderer.render(scene, camera);
    elements.time.textContent = `${seconds.toFixed(2)} s`;
    elements.poses.textContent = JSON.stringify(current.poses.map((pose) => ({
      targetId: pose.targetId,
      rotationXYZW: pose.rotation?.map((number) => +number.toFixed(6)),
      translationMm: pose.translation?.map((number) => +number.toFixed(3)),
    })), null, 2);
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
  elements['rotation-time'].textContent = `${clip.tracks[0].keys.at(-1).timeSeconds.toFixed(2)} s`;
  elements['translation-time'].textContent = `${clip.tracks[1].keys.at(-1).timeSeconds.toFixed(2)} s`;
  seek(0);
  resize();
  elements.loading.hidden = true;
  elements.status.textContent = 'Two GLB animation channels imported';
  document.body.dataset.ready = 'true';
  for (const [id, seconds] of [['start', 0], ['rotation-end', 2.5], ['clip-end', clip.durationSeconds]]) {
    document.getElementById(id).addEventListener('click', () => {
      seek(seconds);
      elements.status.textContent = `${id} accepted`;
    });
  }
  document.getElementById('invalid').addEventListener('click', () => {
    try {
      const damaged = Uint8Array.from(bytes);
      damaged[0] = 0;
      importMotionGlbAnimation(damaged, {
        animationIndex: 0, contextId: 'box-animated',
        nodeTargets: [{ nodeIndex: 2, targetId: 'rotating-box' }, { nodeIndex: 0, targetId: 'moving-box' }],
        frame: 'gltf-y-up-as-part-xyz',
      });
      elements.status.textContent = 'Unexpected damaged GLB acceptance';
    } catch (error) {
      elements.status.textContent = `Import refused: ${error.code}`;
    }
  });
  window.motionGlbDemo = { getState: () => current, getStatus: () => elements.status.textContent, seek };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    geometry.dispose();
    rotationMaterial.dispose();
    translationMaterial.dispose();
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `GLB scene unavailable: ${error.message}`;
  elements.status.textContent = `Load refused: ${error.message}`;
  console.error(error);
}
