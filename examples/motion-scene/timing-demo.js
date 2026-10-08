import { evaluateMotionTiming, parseMotionClipFile, sampleMotionClipWithTiming } from '../../packages/barocss-motion/dist/index.js';

const elements = Object.fromEntries([
  'stage', 'loading', 'curve', 'input-time', 'input-value', 'sampled-value', 'progress-value', 'eased-value',
  'timing-status', 'poses', 'try-invalid',
].map((id) => [id, document.getElementById(id)]));
const curves = {
  identity: { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  flat: { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0, y2: 1 },
};
let clip;
let current;
let currentEvaluation;
let draw = () => {};

function render(sample, evaluation) {
  current = sample;
  currentEvaluation = evaluation;
  elements['input-time'].value = String(sample.inputTimeSeconds);
  elements['input-value'].textContent = `${sample.inputTimeSeconds.toFixed(2)} s`;
  elements['sampled-value'].textContent = `${sample.sampledTimeSeconds.toFixed(2)} s`;
  elements['progress-value'].textContent = `${(evaluation.progress * 100).toFixed(1)}%`;
  elements['eased-value'].textContent = `${(evaluation.easedProgress * 100).toFixed(1)}%`;
  elements.poses.textContent = JSON.stringify(sample.poses.map((pose) => ({
    targetId: pose.targetId,
    translationMm: pose.translation.map((value) => +value.toFixed(3)),
    rotationXYZW: pose.rotation.map((value) => +value.toFixed(4)),
    scale: pose.scale.map((value) => +value.toFixed(3)),
  })), null, 2);
  draw(sample);
}

function sampleAt(timeSeconds, timing = curves[elements.curve.value]) {
  try {
    const evaluation = evaluateMotionTiming(clip.durationSeconds === 0 ? 0 : timeSeconds / clip.durationSeconds, timing);
    const candidate = sampleMotionClipWithTiming(clip, timeSeconds, timing);
    render(candidate, evaluation);
    elements['timing-status'].textContent = 'Sample accepted';
    return true;
  } catch (error) {
    elements['timing-status'].textContent = `Sample refused: ${error.code ?? error.message}`;
    return false;
  }
}

try {
  const response = await fetch('./assets/two-parts.baromotion');
  if (!response.ok) throw new Error(`Clip request failed: ${response.status}`);
  clip = parseMotionClipFile(await response.text());
  if (clip.contextId !== 'sample-assembly') throw new Error('Unexpected clip context');
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
  draw = (sample) => {
    for (const pose of sample.poses) {
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
    if (current) draw(current);
  }
  window.addEventListener('resize', resize);
  resize();
  sampleAt(2);
  elements.loading.hidden = true;
  document.body.dataset.ready = 'true';
  elements['input-time'].addEventListener('input', () => sampleAt(Number(elements['input-time'].value)));
  elements.curve.addEventListener('change', () => sampleAt(current.inputTimeSeconds));
  for (const button of document.querySelectorAll('[data-time]')) {
    button.addEventListener('click', () => sampleAt(Number(button.dataset.time)));
  }
  elements['try-invalid'].addEventListener('click', () => sampleAt(current.inputTimeSeconds,
    { kind: 'cubic-bezier', x1: 2, y1: 0, x2: 1, y2: 1 }));
  window.motionTimingDemo = {
    getState: () => structuredClone(current),
    getEvaluation: () => ({ ...currentEvaluation }),
    getStatus: () => elements['timing-status'].textContent,
    sample: sampleAt,
  };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Timing scene unavailable: ${error.message}`;
  elements['timing-status'].textContent = `Load refused: ${error.message}`;
  console.error(error);
}
