import {
  createMotionRangeTimeline, parseMotionClipFile, parseMotionMarkerFile, serializeMotionMarkerFile,
} from '../../packages/barocss-motion/dist/index.js';

const elements = Object.fromEntries([
  'stage', 'loading', 'play', 'pause', 'seek', 'seek-end', 'mode', 'time', 'iteration',
  'phase', 'state-label', 'events', 'poses', 'save-markers', 'open-markers', 'marker-file-status',
  'range-full', 'range-preview', 'range-invalid', 'range-status',
].map((id) => [id, document.getElementById(id)]));
const log = [];
let timeline;
let markers;
let acceptedFile;
let draw = () => {};

function update(state) {
  elements.seek.min = String(state.range[0]);
  elements.seek.max = String(state.range[1]);
  elements.seek.value = String(state.timeSeconds);
  elements['seek-end'].textContent = `${state.range[1].toFixed(2)} s`;
  elements.time.textContent = `${state.timeSeconds.toFixed(2)} s`;
  elements.iteration.textContent = String(state.iteration);
  elements['state-label'].textContent = `${state.playing ? 'Playing' : 'Paused'} · ${state.mode}`;
  for (const event of state.events) {
    elements.phase.textContent = event.label ?? event.id;
    log.unshift({ id: event.id, timeSeconds: event.timeSeconds, iteration: event.iteration, markerIndex: event.markerIndex });
  }
  if (log.length) elements.events.textContent = log.slice(0, 16).map((event) =>
    `pass ${event.iteration} · ${event.timeSeconds.toFixed(2)} s · ${event.id} (#${event.markerIndex})`).join('\n');
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
  const [clipResponse, markerResponse] = await Promise.all([
    fetch('./assets/two-parts.baromotion'), fetch('./assets/two-parts.baromarkers'),
  ]);
  if (!clipResponse.ok || !markerResponse.ok) throw new Error('Motion asset request failed');
  const clip = parseMotionClipFile(await clipResponse.text());
  if (clip.contextId !== 'sample-assembly') throw new Error('Unexpected clip context');
  const markerText = await markerResponse.text();
  markers = parseMotionMarkerFile(markerText, clip);
  acceptedFile = { name: 'two-parts.baromarkers', bytes: new TextEncoder().encode(markerText).length };
  timeline = createMotionRangeTimeline(clip, { range: [0, clip.durationSeconds], markers, mode: 'clamp' });
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
    draw(timeline.getState());
  }
  window.addEventListener('resize', resize);
  resize();
  update(timeline.getState());
  elements['range-status'].textContent = `Range 0–${clip.durationSeconds} s`;
  elements['marker-file-status'].textContent = `${acceptedFile.name} · ${acceptedFile.bytes} bytes · ${markers.length} markers`;
  elements.loading.hidden = true;
  document.body.dataset.ready = 'true';
  function saveMarkers() {
    const text = serializeMotionMarkerFile(clip, markers);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'two-parts.baromarkers';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements['marker-file-status'].textContent = `Prepared ${anchor.download} · ${blob.size} bytes`;
    return { name: anchor.download, bytes: blob.size, text };
  }
  function setRange(range) {
    try {
      const current = timeline.getState();
      const next = createMotionRangeTimeline(clip, { range, markers, mode: current.mode });
      try {
        const retainedTime = current.timeSeconds >= range[0] && current.timeSeconds <= range[1]
          ? current.timeSeconds : range[0];
        next.seek(retainedTime);
      } catch (error) { next.dispose(); throw error; }
      const previous = timeline;
      timeline = next;
      previous.dispose();
      log.length = 0;
      elements.phase.textContent = '—';
      elements.events.textContent = 'No marker crossings yet.';
      update(timeline.getState());
      elements['range-status'].textContent = `Range ${range[0]}–${range[1]} s · paused`;
      return true;
    } catch (error) {
      elements['range-status'].textContent = `Range refused: ${error.code ?? error.message}`;
      return false;
    }
  }
  async function openMarkers(file) {
    if (!file) return false;
    try {
      if (file.size > 262144) throw new Error('FILE_LIMIT: file exceeds 262144 bytes');
      const text = await file.text();
      const candidate = parseMotionMarkerFile(text, clip);
      const current = timeline.getState();
      const next = createMotionRangeTimeline(clip, { range: current.range, markers: candidate, mode: current.mode });
      try { next.seek(current.timeSeconds); }
      catch (error) { next.dispose(); throw error; }
      const previous = timeline;
      timeline = next;
      markers = candidate;
      acceptedFile = { name: file.name, bytes: file.size };
      previous.dispose();
      log.length = 0;
      elements.phase.textContent = '—';
      elements.events.textContent = 'No marker crossings yet.';
      update(timeline.getState());
      elements['range-status'].textContent = `Range ${current.range[0]}–${current.range[1]} s`;
      elements['marker-file-status'].textContent = `Opened ${acceptedFile.name} · ${acceptedFile.bytes} bytes · ${markers.length} markers`;
      return true;
    } catch (error) {
      elements['marker-file-status'].textContent = `Open refused: ${error.code ?? error.message}`;
      return false;
    }
  }
  elements['save-markers'].addEventListener('click', saveMarkers);
  elements['range-full'].addEventListener('click', () => setRange([0, clip.durationSeconds]));
  elements['range-preview'].addEventListener('click', () => setRange([1, 3]));
  elements['range-invalid'].addEventListener('click', () => setRange([3, 1]));
  elements['open-markers'].addEventListener('change', async (event) => {
    await openMarkers(event.target.files?.[0]);
    event.target.value = '';
  });
  elements.play.addEventListener('click', () => update(timeline.play()));
  elements.pause.addEventListener('click', () => update(timeline.pause()));
  elements.seek.addEventListener('input', () => update(timeline.seek(Number(elements.seek.value))));
  elements.mode.addEventListener('change', () => update(timeline.setMode(elements.mode.value)));
  for (const button of document.querySelectorAll('[data-seek]')) {
    button.addEventListener('click', () => update(timeline.seek(timeline.getState().range[0])));
  }
  for (const button of document.querySelectorAll('[data-advance]')) {
    button.addEventListener('click', () => update(timeline.advance(Number(button.dataset.advance))));
  }
  window.motionTimelineDemo = {
    getState: () => timeline.getState(),
    getLog: () => log.map((event) => ({ ...event })),
    getAcceptedFile: () => ({ ...acceptedFile }),
    getFileStatus: () => elements['marker-file-status'].textContent,
    getRangeStatus: () => elements['range-status'].textContent,
    saveMarkers,
    openMarkers,
    setRange,
    advance: (seconds) => update(timeline.advance(seconds)),
    play: () => update(timeline.play()),
    pause: () => update(timeline.pause()),
    seek: (seconds) => update(timeline.seek(seconds)),
    setMode: (mode) => update(timeline.setMode(mode)),
  };
  let previous = performance.now();
  let frameId;
  function frame(now) {
    const seconds = Math.max(0, Math.min((now - previous) / 1000, 0.05));
    previous = now;
    if (timeline.getState().playing) update(timeline.advance(seconds));
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
    renderer.dispose();
    timeline.dispose();
  }, { once: true });
} catch (error) {
  elements.loading.textContent = `Timeline unavailable: ${error.message}`;
  console.error(error);
}
