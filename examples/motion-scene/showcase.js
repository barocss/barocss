import { createMotionClip, createMotionTimeline } from '../../packages/barocss-motion/dist/index.js';
import { showcaseScenarios } from './showcase-clips.mjs';

const ids = [
  'viewport', 'stage', 'loading', 'scene-phase', 'scene-time', 'scene-destination', 'play', 'play-label', 'restart', 'speed',
  'seek', 'time', 'end-time', 'phase-list', 'current-phase', 'phase-detail', 'repeat',
  'play-state', 'marker-status', 'parcel-x', 'parcel-y', 'carriage-x', 'raw-state',
];
const ui = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const scenarios = showcaseScenarios.map((scenario) => ({ ...scenario, clip: createMotionClip(scenario.clipInput) }));
let selected = scenarios[0];
let timeline = createMotionTimeline(selected.clip, { version: 0, markers: selected.markers, mode: 'clamp' });
let draw = () => {};
let markerCount = 0;

const phaseDetails = {
  접근: '집는 위치로 이동합니다.', 집기: '집게가 부품을 잡습니다.', 이동: '부품을 들어 옮깁니다.',
  놓기: '부품을 내려놓습니다.', 복귀: '이동 축이 시작 위치로 돌아갑니다.',
  검사: '부품을 돌려 검사합니다.',
};
const poseFor = (state, targetId) => state.poses.find((pose) => pose.targetId === targetId);
const formatMm = (value) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(0)} mm`;

function makePhaseButtons() {
  ui['phase-list'].replaceChildren();
  for (const phase of selected.phases) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = phase.label;
    button.title = `${phase.timeSeconds.toFixed(1)}초로 이동`;
    button.dataset.time = String(phase.timeSeconds);
    button.addEventListener('click', () => update(timeline.seek(phase.timeSeconds)));
    ui['phase-list'].append(button);
  }
}

function update(state) {
  const time = state.timeSeconds;
  const phase = selected.phases.findLast((entry) => entry.timeSeconds <= time) ?? selected.phases[0];
  const parcel = poseFor(state, 'parcel');
  const carriage = poseFor(state, 'carriage');
  ui.seek.value = String(time);
  ui.seek.style.setProperty('--progress', `${100 * time / selected.durationSeconds}%`);
  ui.time.textContent = `${time.toFixed(2)} s`;
  ui['scene-time'].textContent = `${time.toFixed(2)} / ${selected.durationSeconds.toFixed(2)} s`;
  ui['scene-phase'].textContent = phase.label;
  ui['current-phase'].textContent = phase.label;
  ui['phase-detail'].textContent = phaseDetails[phase.label];
  ui['play-state'].textContent = state.playing ? '재생 중' : '일시 정지';
  ui['play-label'].textContent = state.playing ? '일시 정지' : '재생';
  ui.play.setAttribute('aria-label', state.playing ? '일시 정지' : '재생');
  ui.play.firstElementChild.textContent = state.playing ? 'Ⅱ' : '▶';
  for (const button of ui['phase-list'].children) {
    const active = button.dataset.time === String(phase.timeSeconds);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  ui['parcel-x'].textContent = formatMm(parcel.translation[0]);
  ui['parcel-y'].textContent = formatMm(parcel.translation[1]);
  ui['carriage-x'].textContent = formatMm(carriage.translation[0]);
  ui['raw-state'].textContent = JSON.stringify({ clip: selected.id, timeSeconds: time, poses: state.poses }, null, 2);
  if (state.events.length) {
    markerCount += state.events.length;
    const event = state.events.at(-1);
    ui['marker-status'].textContent = `마커 ${markerCount} · ${event.label} (${event.timeSeconds.toFixed(1)} s)`;
    ui['marker-status'].classList.remove('flash');
    void ui['marker-status'].offsetWidth;
    ui['marker-status'].classList.add('flash');
  }
  draw(state);
  return state;
}

function selectClip(id) {
  const next = scenarios.find((scenario) => scenario.id === id);
  if (!next || next === selected) return;
  const mode = ui.repeat.checked ? 'repeat' : 'clamp';
  const replacement = createMotionTimeline(next.clip, { version: 0, markers: next.markers, mode });
  timeline.dispose();
  timeline = replacement;
  selected = next;
  ui.viewport.dataset.clip = next.id;
  ui.stage.setAttribute('aria-label', next.id === 'inspection' ? '부품을 집고 검사한 뒤 되돌리는 작업 셀' : '부품을 집고 옮기는 작업 셀');
  ui['scene-destination'].textContent = next.id === 'inspection' ? '02 검사 위치' : '02 놓는 위치';
  markerCount = 0;
  ui['marker-status'].textContent = '마커를 지날 때 동작이 표시됩니다.';
  ui['marker-status'].classList.remove('flash');
  ui.seek.max = String(next.durationSeconds);
  ui['end-time'].textContent = `${next.durationSeconds} s`;
  for (const button of document.querySelectorAll('[data-clip]')) {
    button.setAttribute('aria-pressed', String(button.dataset.clip === id));
  }
  makePhaseButtons();
  update(timeline.getState());
}

makePhaseButtons();
update(timeline.getState());
for (const button of document.querySelectorAll('[data-clip]')) {
  button.addEventListener('click', () => selectClip(button.dataset.clip));
}
ui.play.addEventListener('click', () => update(timeline.getState().playing ? timeline.pause() : timeline.play()));
ui.restart.addEventListener('click', () => {
  timeline.pause();
  markerCount = 0;
  ui['marker-status'].textContent = '처음 위치로 돌아왔습니다.';
  update(timeline.seek(0));
});
ui.seek.addEventListener('input', () => update(timeline.seek(Number(ui.seek.value))));
ui.repeat.addEventListener('change', () => update(timeline.setMode(ui.repeat.checked ? 'repeat' : 'clamp')));

try {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas: ui.stage, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10242b);
  scene.fog = new THREE.Fog(0x10242b, 450, 850);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  camera.position.set(260, 205, 330);
  camera.lookAt(0, 62, 0);
  scene.add(new THREE.HemisphereLight(0xd7fcf7, 0x395966, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(-100, 260, 180);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -230;
  key.shadow.camera.right = 230;
  key.shadow.camera.top = 220;
  key.shadow.camera.bottom = -220;
  scene.add(key);
  const edgeLight = new THREE.DirectionalLight(0x68d8c7, 1.2);
  edgeLight.position.set(160, 140, -140);
  scene.add(edgeLight);

  const metal = new THREE.MeshStandardMaterial({ color: 0x829fa6, metalness: 0.75, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263d47, metalness: 0.65, roughness: 0.5 });
  const rail = new THREE.MeshStandardMaterial({ color: 0xadc5c8, metalness: 0.8, roughness: 0.24 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x58e0c7, metalness: 0.38, roughness: 0.3 });
  const parcelMaterial = new THREE.MeshStandardMaterial({ color: 0xe9b96d, metalness: 0.2, roughness: 0.48 });
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x2b565c, metalness: 0.42, roughness: 0.55 });
  function box(parent, width, height, depth, x, y, z, material, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, radius, height, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(scene, 350, 10, 165, 0, 0, 0, dark);
  box(scene, 324, 2, 116, 0, 6, 0, metal);
  for (const x of [-153, 153]) {
    box(scene, 11, 155, 18, x, 78, -12, metal);
    box(scene, 16, 9, 28, x, 151, -12, dark);
  }
  box(scene, 320, 12, 20, 0, 151, -12, rail);
  box(scene, 318, 3, 4, 0, 144, 1, accent);
  for (const x of [-105, 105]) {
    box(scene, 62, 3, 70, x, 8, 0, padMaterial);
    for (const z of [-31, 31]) box(scene, 48, 2, 2, x, 11, z, accent, false);
  }
  const scanner = new THREE.Group();
  scanner.position.set(0, 17, -42);
  box(scanner, 62, 4, 12, 0, 0, 0, dark);
  for (const x of [-27, 27]) box(scanner, 4, 96, 4, x, 48, 0, rail);
  box(scanner, 58, 8, 10, 0, 97, 0, dark);
  box(scanner, 37, 2, 6, 0, 91, 0, accent, false);
  scene.add(scanner);
  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x62e8d2, transparent: true, opacity: 0.13, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(16, 26, 82, 32, 1, true), beamMaterial);
  beam.position.set(0, 54, -42);
  beam.visible = false;
  scene.add(beam);

  const carriage = new THREE.Group();
  box(carriage, 58, 28, 43, 0, 0, -12, dark);
  box(carriage, 48, 3, 44, 0, 15, -12, accent);
  for (const x of [-21, 21]) cylinder(carriage, 5, 8, x, -16, -12, metal);
  scene.add(carriage);
  const lift = new THREE.Group();
  box(lift, 13, 85, 13, 0, 37, 0, rail);
  box(lift, 41, 14, 23, 0, 0, 0, dark);
  box(lift, 31, 4, 21, 0, -9, 0, accent);
  carriage.add(lift);
  const jawLeft = new THREE.Group();
  const jawRight = new THREE.Group();
  for (const jaw of [jawLeft, jawRight]) {
    box(jaw, 6, 37, 9, 0, -27, 0, metal);
    box(jaw, 10, 5, 12, 0, -44, 0, dark);
    lift.add(jaw);
  }
  const parcel = new THREE.Group();
  box(parcel, 39, 29, 34, 0, 0, 0, parcelMaterial);
  box(parcel, 39, 3, 34, 0, 15, 0, rail);
  box(parcel, 8, 2, 34, 0, 17, 0, accent, false);
  box(parcel, 39, 2, 6, 0, -14, 0, dark);
  scene.add(parcel);

  const objects = new Map([['carriage', carriage], ['lift', lift], ['jaw-left', jawLeft],
    ['jaw-right', jawRight], ['parcel', parcel]]);
  draw = (state) => {
    for (const pose of state.poses) {
      const object = objects.get(pose.targetId);
      if (pose.translation) object.position.set(...pose.translation);
      if (pose.rotation) object.quaternion.set(...pose.rotation);
    }
    beam.visible = selected.id === 'inspection' && state.timeSeconds >= 2.7 && state.timeSeconds <= 4.2;
    renderer.render(scene, camera);
  };
  function resize() {
    const width = ui.stage.clientWidth;
    const height = ui.stage.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(timeline.getState());
  }
  window.addEventListener('resize', resize);
  resize();
  ui.loading.hidden = true;
  document.body.dataset.ready = 'true';
  window.motionShowcase = {
    getState: () => timeline.getState(), getClipId: () => selected.id,
    seek: (seconds) => update(timeline.seek(seconds)), selectClip,
  };
  let previous = performance.now();
  let frameId;
  function frame(now) {
    const seconds = Math.max(0, Math.min((now - previous) / 1000, 0.05));
    previous = now;
    if (timeline.getState().playing) update(timeline.advance(seconds * Number(ui.speed.value)));
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    scene.traverse((object) => { object.geometry?.dispose(); });
    for (const material of [metal, dark, rail, accent, parcelMaterial, padMaterial, beamMaterial]) material.dispose();
    renderer.dispose();
    timeline.dispose();
  }, { once: true });
} catch (error) {
  ui.loading.textContent = `3D 장면을 열지 못했습니다: ${error.message}`;
  console.error(error);
}
