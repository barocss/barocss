const byId = id => document.getElementById(id);
const controls = ['shadow', 'source-x', 'target-x', 'angle', 'penumbra', 'shadow-radius', 'range', 'intensity'].map(byId);
const status = byId('status'), error = byId('error'), captureButton = byId('capture');
let api = null, viewer = null, sourceMarker = null, axis = null, closed = false, capturing = false, epoch = 0;

function showError(reason) {
  error.textContent = `${reason.code ? `${reason.code}: ` : ''}${reason.message ?? String(reason)}`;
  error.hidden = false;
}
function cleanup() { closed = true; epoch++; viewer?.dispose(); }
window.addEventListener('beforeunload', cleanup, { once: true });

function updateLight() {
  epoch++;
  const x = Number(byId('source-x').value), aim = Number(byId('target-x').value);
  const angle = Number(byId('angle').value), range = Number(byId('range').value), intensity = Number(byId('intensity').value), castShadow = byId('shadow').checked;
  const penumbra = Number(byId('penumbra').value), shadowRadius = Number(byId('shadow-radius').value);
  const position = [x, -3, 7], target = [aim, 0, 0.6], direction = target.map((value, i) => value - position[i]);
  viewer.lights = [
    { kind: 'directional', direction: [-0.3, 0.4, -1], color: '#486994', intensity: 0.3 },
    { kind: 'spot', position, direction, color: '#ffe8bd', intensity, angle, penumbra, shadowRadius, range, castShadow },
  ];
  sourceMarker.transform = api.translation(position);
  const line = api.identity();
  for (let i = 0; i < 3; i++) { line[8 + i] = direction[i]; line[12 + i] = position[i]; }
  axis.transform = line;
  viewer.requestRender();
  byId('source-value').value = x.toFixed(1); byId('target-value').value = aim.toFixed(1);
  byId('angle-value').value = `${angle}°`; byId('range-value').value = String(range); byId('intensity-value').value = String(intensity);
  byId('penumbra-value').value = penumbra.toFixed(1); byId('radius-value').value = shadowRadius.toFixed(1);
  error.hidden = true;
  status.textContent = `Spot shadow ${castShadow ? 'on' : 'off'} · source X ${x.toFixed(1)} · aim X ${aim.toFixed(1)} · cone ${angle}° · beam fade ${penumbra.toFixed(1)} · light radius ${shadowRadius.toFixed(1)} · range ${range}${capturing ? ' · earlier capture discarded' : ''}`;
}

captureButton.addEventListener('click', async () => {
  if (!viewer || closed || capturing) return;
  const capturedEpoch = ++epoch, caption = status.textContent;
  capturing = true; captureButton.disabled = true;
  try {
    const frame = await viewer.capture();
    if (closed || capturedEpoch !== epoch) return;
    const canvas = byId('still'); canvas.width = frame.width; canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('A 2D canvas context is required to display the capture.');
    context.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
    byId('capture-caption').textContent = `${caption} · ${frame.width} × ${frame.height}`;
    byId('capture-output').hidden = false;
    status.textContent = 'Preview captured. Move the light to compare the live view.';
  } catch (reason) {
    if (!closed && capturedEpoch === epoch) { showError(reason); status.textContent = 'Capture failed.'; }
  } finally { capturing = false; captureButton.disabled = closed; }
});

function box(sx, sy, sz, at) {
  const positions = [], normals = [], indices = [], half = [sx / 2, sy / 2, sz / 2];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 0, 0], n = [0, 0, 0]; p[axis] = sign * half[axis]; p[u] = a * half[u]; p[v] = b * half[v] * sign; n[axis] = sign;
      positions.push(...p.map((value, i) => value + at[i])); normals.push(...n);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

try {
  api = await import('../dist/viewer/index.js');
  if (closed) throw new Error('The page closed before the viewer loaded.');
  viewer = await api.createViewer(byId('view'), {
    pixelRatio: 1, antialias: true, background: '#20242b',
    camera: { position: [10, -13, 10], target: [0, 0, 2], up: [0, 0, 1] },
    environment: { ambient: 0.04, sky: '#ffffff', ground: '#ffffff', toneMapping: 'none' },
    onError: message => { if (!closed) showError(new Error(message)); },
  });
  if (closed) { viewer.dispose(); throw new Error('The page closed before viewer creation completed.'); }
  viewer.add({ positions: [-7, -6, 0, 7, -6, 0, 7, 6, 0, -7, 6, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
    { material: { color: '#dddddd', roughness: 1 }, castShadow: false });
  viewer.add(box(1.4, 1.4, 3.2, [0, 0, 1.6]), { material: { color: '#b9b9b9', roughness: 0.8 }, castShadow: true });
  sourceMarker = viewer.add(box(0.25, 0.25, 0.25, [0, 0, 0]), { material: { color: '#ffe8bd', unlit: true }, bounded: false, castShadow: false, pickable: false });
  axis = viewer.add({ positions: [0, 0, 0, 0, 0, 1], topology: 'lines' }, { material: { color: '#b39965', unlit: true, lineWidth: 1 }, bounded: false, castShadow: false, pickable: false });
  viewer.camera.fit({ min: [-7, -6, 0], max: [7, 6, 7.5] }, viewer.aspect);
  for (const control of controls) {
    control.disabled = false;
    control.addEventListener('input', () => {
      try { updateLight(); } catch (reason) { showError(reason); status.textContent = 'Spot light update failed.'; }
    });
  }
  captureButton.disabled = false;
  updateLight();
} catch (reason) {
  if (!closed) { showError(reason); status.textContent = 'The spot shadow example could not start.'; }
  cleanup();
}
