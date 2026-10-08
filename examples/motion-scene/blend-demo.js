import { parseMotionClipFile, sampleMotionBlend } from '../../packages/barocss-motion/dist/index.js';

const elements = Object.fromEntries([
  'stage', 'loading', 'from-file', 'to-file', 'file-status', 'from-time', 'to-time',
  'weight', 'from-value', 'to-value', 'weight-value', 'blend-label', 'poses',
].map((id) => [id, document.getElementById(id)]));
let fromClip;
let toClip;
let current;
let draw = () => {};

function render(sample) {
  current = sample;
  elements['from-time'].value = String(sample.fromTimeSeconds);
  elements['to-time'].value = String(sample.toTimeSeconds);
  elements.weight.value = String(sample.weight);
  elements['from-value'].textContent = `${sample.fromTimeSeconds.toFixed(2)} s`;
  elements['to-value'].textContent = `${sample.toTimeSeconds.toFixed(2)} s`;
  elements['weight-value'].textContent = sample.weight.toFixed(2);
  elements['blend-label'].textContent = `weight ${sample.weight.toFixed(2)}`;
  elements.poses.textContent = JSON.stringify(sample.poses.map((pose) => ({
    targetId: pose.targetId,
    translationMm: pose.translation.map((number) => +number.toFixed(3)),
    rotationXYZW: pose.rotation.map((number) => +number.toFixed(4)),
    scale: pose.scale.map((number) => +number.toFixed(3)),
  })), null, 2);
  draw(sample);
  return sample;
}

function sampleAt(fromTimeSeconds = Number(elements['from-time'].value),
  toTimeSeconds = Number(elements['to-time'].value), weight = Number(elements.weight.value)) {
  return render(sampleMotionBlend(fromClip, fromTimeSeconds, toClip, toTimeSeconds, weight));
}

async function openFile(side) {
  const input = elements[`${side}-file`];
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_048_576) throw new Error('File exceeds 1 MiB');
    const candidate = parseMotionClipFile(await file.text());
    const nextFrom = side === 'from' ? candidate : fromClip;
    const nextTo = side === 'to' ? candidate : toClip;
    const fromTime = Math.min(Number(elements['from-time'].value), nextFrom.durationSeconds);
    const toTime = Math.min(Number(elements['to-time'].value), nextTo.durationSeconds);
    const sample = sampleMotionBlend(nextFrom, fromTime, nextTo, toTime, Number(elements.weight.value));
    fromClip = nextFrom;
    toClip = nextTo;
    elements['from-time'].max = String(fromClip.durationSeconds);
    elements['to-time'].max = String(toClip.durationSeconds);
    render(sample);
    elements['file-status'].textContent = `${side === 'from' ? 'Source' : 'Destination'} opened: ${file.name}`;
  } catch (error) {
    elements['file-status'].textContent = `Open refused: ${error.message}`;
  } finally {
    input.value = '';
  }
}

try {
  const [sourceResponse, targetResponse] = await Promise.all([
    fetch('./assets/two-parts.baromotion'), fetch('./assets/two-parts-blend-target.baromotion'),
  ]);
  if (!sourceResponse.ok || !targetResponse.ok) throw new Error('Clip asset request failed');
  fromClip = parseMotionClipFile(await sourceResponse.text());
  toClip = parseMotionClipFile(await targetResponse.text());
  const first = sampleMotionBlend(fromClip, 2, toClip, 2, 0.5);
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
    draw(current);
  }
  window.addEventListener('resize', resize);
  render(first);
  resize();
  elements.loading.hidden = true;
  elements['file-status'].textContent = 'Loaded two compatible native clip files';
  document.body.dataset.ready = 'true';
  elements['from-file'].addEventListener('change', () => openFile('from'));
  elements['to-file'].addEventListener('change', () => openFile('to'));
  for (const id of ['from-time', 'to-time', 'weight']) {
    elements[id].addEventListener('input', () => sampleAt());
  }
  for (const button of document.querySelectorAll('[data-weight]')) {
    button.addEventListener('click', () => sampleAt(undefined, undefined, Number(button.dataset.weight)));
  }
  window.motionBlendDemo = {
    getState: () => structuredClone(current),
    getStatus: () => elements['file-status'].textContent,
    sample: (fromTime, toTime, weight) => sampleAt(fromTime, toTime, weight),
  };
  window.addEventListener('pagehide', () => {
    window.removeEventListener('resize', resize);
    scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Blend scene unavailable: ${error.message}`;
  elements['file-status'].textContent = `Load refused: ${error.message}`;
  console.error(error);
}
