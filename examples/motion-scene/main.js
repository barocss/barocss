import { createMotionClip, createMotionPlayer } from '../../packages/barocss-motion/dist/index.js';
import { clipInput } from './clip.mjs';

const clip = createMotionClip(clipInput);
const player = createMotionPlayer(clip, { mode: 'clamp' });
const elements = {
  canvas: document.querySelector('#stage'),
  loading: document.querySelector('#loading'),
  play: document.querySelector('#play'),
  pause: document.querySelector('#pause'),
  seek: document.querySelector('#seek'),
  mode: document.querySelector('#mode'),
  time: document.querySelector('#time'),
  poses: document.querySelector('#poses'),
  stateLabel: document.querySelector('#state-label'),
};

function readout(state) {
  elements.seek.value = String(state.timeSeconds);
  elements.time.textContent = `${state.timeSeconds.toFixed(2)} s`;
  elements.stateLabel.textContent = `${state.playing ? 'Playing' : 'Paused'} · ${state.mode}`;
  elements.poses.textContent = JSON.stringify(state.poses.map((pose) => ({
    targetId: pose.targetId,
    translationMm: pose.translation.map((number) => +number.toFixed(3)),
    rotationXYZW: pose.rotation.map((number) => +number.toFixed(4)),
    scale: pose.scale.map((number) => +number.toFixed(3)),
  })), null, 2);
}

let applyPose = () => {};
function update(state) { readout(state); applyPose(state); }
elements.play.addEventListener('click', () => update(player.play()));
elements.pause.addEventListener('click', () => update(player.pause()));
elements.seek.addEventListener('input', () => update(player.seek(Number(elements.seek.value))));
elements.mode.addEventListener('change', () => update(player.setMode(elements.mode.value)));
for (const button of document.querySelectorAll('[data-seek]')) {
  button.addEventListener('click', () => update(player.seek(Number(button.dataset.seek))));
}
readout(player.getState());

// Host-owned drawing and clock. The library never imports Three or calls rAF.
try {
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
  const backLight = new THREE.DirectionalLight(0x52ffce, 1.7);
  backLight.position.set(120, -20, -100);
  scene.add(backLight);

  const floor = new THREE.GridHelper(320, 16, 0x235267, 0x193b4d);
  floor.position.y = -60;
  scene.add(floor);
  const axes = new THREE.AxesHelper(30);
  axes.position.set(-130, -50, 0);
  scene.add(axes);

  const objects = new Map();
  const boxGeometry = new THREE.BoxGeometry(46, 38, 38);
  const box = new THREE.Mesh(boxGeometry, new THREE.MeshStandardMaterial({ color: 0x40d9c0, metalness: 0.35, roughness: 0.28 }));
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial({ color: 0xa8fff0 })));
  objects.set('part-a', box);
  scene.add(box);
  const sphereGeometry = new THREE.IcosahedronGeometry(26, 2);
  const sphere = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xffad59, metalness: 0.25, roughness: 0.32, flatShading: true }));
  sphere.add(new THREE.LineSegments(new THREE.EdgesGeometry(sphereGeometry), new THREE.LineBasicMaterial({ color: 0xffdd9d, transparent: true, opacity: 0.45 })));
  objects.set('part-b', sphere);
  scene.add(sphere);

  applyPose = (state) => {
    for (const pose of state.poses) {
      const object = objects.get(pose.targetId);
      object.position.set(...pose.translation); // renderer units equal sample mm
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
    applyPose(player.getState());
  }
  window.addEventListener('resize', resize);
  resize();
  elements.loading.hidden = true;
  document.body.dataset.ready = 'true';
  window.motionDemo = { getState: () => player.getState(), getObjectIds: () => [...objects.keys()] };
  let previous = performance.now();
  let frameId;
  function frame(now) {
    const elapsedSeconds = Math.max(0, Math.min((now - previous) / 1000, 0.05));
    previous = now;
    if (player.getState().playing) update(player.advance(elapsedSeconds));
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    renderer.dispose();
    player.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Renderer unavailable: ${error.message}`;
  console.error(error);
}
