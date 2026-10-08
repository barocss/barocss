import {
  createMotionPlayer, parseMotionClipFile, serializeMotionClipFile,
} from '../../packages/barocss-motion/dist/index.js';

const elements = {
  canvas: document.querySelector('#stage'),
  loading: document.querySelector('#loading'),
  status: document.querySelector('#file-status'),
  save: document.querySelector('#save'),
  open: document.querySelector('#open'),
  play: document.querySelector('#play'),
  pause: document.querySelector('#pause'),
  seek: document.querySelector('#seek'),
  mode: document.querySelector('#mode'),
  time: document.querySelector('#time'),
  poses: document.querySelector('#poses'),
  stateLabel: document.querySelector('#state-label'),
  context: document.querySelector('#context'),
  targets: document.querySelector('#targets'),
};
const expectedPairs = new Set([
  'part-a:translation', 'part-a:rotation', 'part-a:scale',
  'part-b:translation', 'part-b:rotation', 'part-b:scale',
]);
let activeClip;
let player;
let draw = () => {};

function bindClip(clip) {
  if (clip.contextId !== 'sample-assembly') throw new Error('This scene needs context sample-assembly');
  const pairs = clip.tracks.map((track) => `${track.targetId}:${track.property}`);
  if (pairs.length !== expectedPairs.size || pairs.some((pair) => !expectedPairs.has(pair))) {
    throw new Error('This scene needs exact part-a and part-b TRS tracks');
  }
  return createMotionPlayer(clip, { mode: elements.mode.value });
}

function update(state) {
  elements.seek.value = String(state.timeSeconds);
  elements.time.textContent = `${state.timeSeconds.toFixed(2)} s`;
  elements.stateLabel.textContent = `${state.playing ? 'Playing' : 'Paused'} · ${state.mode}`;
  elements.poses.textContent = JSON.stringify(state.poses.map((pose) => ({
    targetId: pose.targetId,
    translationMm: pose.translation.map((number) => +number.toFixed(3)),
    rotationXYZW: pose.rotation.map((number) => +number.toFixed(4)),
    scale: pose.scale.map((number) => +number.toFixed(3)),
  })), null, 2);
  draw(state);
}

function adopt(clip) {
  const nextPlayer = bindClip(clip);
  const prior = player;
  activeClip = clip;
  player = nextPlayer;
  prior?.dispose();
  elements.context.textContent = `Context: ${clip.contextId}`;
  elements.targets.textContent = 'Targets: part-a, part-b';
  update(player.getState());
}

elements.save.addEventListener('click', () => {
  try {
    const text = serializeMotionClipFile(activeClip);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'two-parts.baromotion';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.status.textContent = `Save prepared · ${new Blob([text]).size} UTF-8 bytes`;
  } catch (error) {
    elements.status.textContent = `Save refused · ${error.message}`;
  }
});
elements.open.addEventListener('change', async () => {
  const file = elements.open.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_048_576) throw new Error('File exceeds 1 MiB');
    const clip = parseMotionClipFile(await file.text());
    adopt(clip);
    elements.status.textContent = `Opened ${file.name} · validated clip`;
  } catch (error) {
    elements.status.textContent = `Open refused · ${error.message}`;
  } finally {
    elements.open.value = '';
  }
});
elements.play.addEventListener('click', () => update(player.play()));
elements.pause.addEventListener('click', () => update(player.pause()));
elements.seek.addEventListener('input', () => update(player.seek(Number(elements.seek.value))));
elements.mode.addEventListener('change', () => update(player.setMode(elements.mode.value)));
for (const button of document.querySelectorAll('[data-seek]')) {
  button.addEventListener('click', () => update(player.seek(Number(button.dataset.seek))));
}

try {
  const response = await fetch('./assets/two-parts.baromotion');
  if (!response.ok) throw new Error(`Asset request failed: ${response.status}`);
  adopt(parseMotionClipFile(await response.text()));
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: true });
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
    const width = elements.canvas.clientWidth;
    const height = elements.canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(player.getState());
  }
  window.addEventListener('resize', resize);
  resize();
  elements.loading.hidden = true;
  elements.status.textContent = 'Loaded native .baromotion file';
  document.body.dataset.ready = 'true';
  window.motionFileDemo = { getState: () => player.getState(), getTrackIds: () => activeClip.tracks.map((track) => track.targetId), getStatus: () => elements.status.textContent };
  let previous = performance.now();
  let frameId;
  function frame(now) {
    const seconds = Math.max(0, Math.min((now - previous) / 1000, 0.05));
    previous = now;
    if (player.getState().playing) update(player.advance(seconds));
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.dispose();
    player.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Clip scene unavailable: ${error.message}`;
  elements.status.textContent = `Load refused · ${error.message}`;
  console.error(error);
}
