import { createMotionTransitionPlayer, parseMotionClipFile } from '../../packages/barocss-motion/dist/index.js';

const elements = Object.fromEntries([
  'stage', 'loading', 'status', 'phase', 'source-time', 'destination-time', 'fade', 'state-label', 'poses',
].map((id) => [id, document.getElementById(id)]));
let current;
let draw = () => {};

function render(state) {
  current = state;
  elements.phase.textContent = state.phase;
  elements['source-time'].textContent = `${state.sourceTimeSeconds.toFixed(2)} s`;
  elements['destination-time'].textContent = state.destinationTimeSeconds === null
    ? '—' : `${state.destinationTimeSeconds.toFixed(2)} s`;
  elements.fade.textContent = `${state.fadeProgress.toFixed(2)} / ${state.weight.toFixed(2)}`;
  elements['state-label'].textContent = state.playing ? 'playing' : 'paused';
  elements.poses.textContent = JSON.stringify(state.poses.map((pose) => ({
    targetId: pose.targetId,
    translationMm: pose.translation.map((number) => +number.toFixed(3)),
    rotationXYZW: pose.rotation.map((number) => +number.toFixed(4)),
    scale: pose.scale.map((number) => +number.toFixed(3)),
  })), null, 2);
  draw(state);
  return state;
}

try {
  const responses = await Promise.all([
    fetch('./assets/two-parts.baromotion'),
    fetch('./assets/two-parts-blend-target.baromotion'),
    fetch('./assets/wrong-context.baromotion'),
  ]);
  if (responses.some((response) => !response.ok)) throw new Error('Clip asset request failed');
  const [source, target, incompatible] = await Promise.all(responses.map(async (response) => parseMotionClipFile(await response.text())));
  const player = createMotionTransitionPlayer(source, { mode: 'clamp' });
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: elements.stage, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1b29);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 1500);
  camera.position.set(0, 90, 300);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc8f4ff, 0x1a3f50, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-90, 130, 180);
  scene.add(light);
  const floor = new THREE.GridHelper(320, 16, 0x235267, 0x193b4d);
  floor.position.y = -60;
  scene.add(floor);
  const objects = new Map();
  const box = new THREE.Mesh(new THREE.BoxGeometry(46, 38, 38),
    new THREE.MeshStandardMaterial({ color: 0x40d9c0, metalness: 0.35, roughness: 0.28 }));
  const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 2),
    new THREE.MeshStandardMaterial({ color: 0xffad59, metalness: 0.25, roughness: 0.32, flatShading: true }));
  objects.set('part-a', box);
  objects.set('part-b', sphere);
  scene.add(box, sphere);
  draw = (state) => {
    for (const pose of state.poses) {
      const object = objects.get(pose.targetId);
      object.position.set(...pose.translation);
      object.quaternion.set(...pose.rotation);
      object.scale.set(...pose.scale);
    }
    renderer.render(scene, camera);
  };
  function resize() {
    const width = elements.stage.clientWidth;
    const height = elements.stage.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(current);
  }
  window.addEventListener('resize', resize);
  render(player.getState());
  resize();
  elements.loading.hidden = true;
  elements.status.textContent = 'Two native clip files loaded';
  document.body.dataset.ready = 'true';
  const actions = {
    'seek-one': () => player.seek(1),
    transition: () => player.transitionTo(target, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 }),
    play: () => player.play(),
    pause: () => player.pause(),
    advance: () => player.advance(1),
    invalid: () => player.transitionTo(incompatible, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 }),
  };
  for (const [id, action] of Object.entries(actions)) {
    document.getElementById(id).addEventListener('click', () => {
      try {
        render(action());
        elements.status.textContent = `${id} accepted`;
      } catch (error) {
        elements.status.textContent = `${id} refused: ${error.message}`;
      }
    });
  }
  window.motionTransitionDemo = {
    getState: () => player.getState(),
    getStatus: () => elements.status.textContent,
    seek: (time) => render(player.seek(time)),
    transition: () => render(actions.transition()),
    advance: (delta) => render(player.advance(delta)),
  };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    player.dispose();
    scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Transition scene unavailable: ${error.message}`;
  elements.status.textContent = `Load refused: ${error.message}`;
  console.error(error);
}
