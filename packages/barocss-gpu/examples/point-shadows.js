const byId = id => document.getElementById(id);
const controls = ['shadow', 'source-x', 'source-y', 'source-z', 'shadow-radius', 'range', 'intensity'].map(byId);
const status = byId('status'), error = byId('error'), captureButton = byId('capture');
let api = null, viewer = null, marker = null, closed = false, capturing = false, epoch = 0;

function showError(reason) {
  error.textContent = `${reason.code ? `${reason.code}: ` : ''}${reason.message ?? String(reason)}`;
  error.hidden = false;
}
function cleanup() { closed = true; epoch++; viewer?.dispose(); }
window.addEventListener('beforeunload', cleanup, { once: true });

function updateLight() {
  epoch++;
  const position = ['source-x', 'source-y', 'source-z'].map(id => Number(byId(id).value));
  const range = Number(byId('range').value), intensity = Number(byId('intensity').value), castShadow = byId('shadow').checked;
  const shadowRadius = Number(byId('shadow-radius').value);
  viewer.lights = [
    { kind: 'directional', direction: [-0.3, 0.4, -1], color: '#486994', intensity: 0.2 },
    { kind: 'point', position, color: '#ffe8bd', intensity, range, castShadow, shadowRadius },
  ];
  marker.transform = api.translation(position);
  viewer.requestRender();
  ['x-value', 'y-value', 'z-value'].forEach((id, i) => { byId(id).value = position[i].toFixed(1); });
  byId('range-value').value = String(range); byId('intensity-value').value = String(intensity);
  byId('radius-value').value = shadowRadius.toFixed(1);
  error.hidden = true;
  status.textContent = `Point shadow ${castShadow ? 'on' : 'off'} · source [${position.map(value => value.toFixed(1)).join(', ')}] · light radius ${shadowRadius.toFixed(1)} · range ${range}${capturing ? ' · earlier capture discarded' : ''}`;
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
    status.textContent = 'Preview captured. Move the point light to compare the live view.';
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
    camera: { position: [12, -16, 12], target: [0, 0, 2.5], up: [0, 0, 1] },
    environment: { ambient: 0.03, sky: '#ffffff', ground: '#ffffff', toneMapping: 'none' },
    onError: message => { if (!closed) showError(new Error(message)); },
  });
  if (closed) { viewer.dispose(); throw new Error('The page closed before viewer creation completed.'); }
  const receiver = (positions, normal) => viewer.add({ positions, normals: Array.from({ length: 4 }, () => normal).flat(), indices: [0, 1, 2, 0, 2, 3] },
    { material: { color: '#c8c8c8', roughness: 1 }, castShadow: false });
  receiver([-6, -6, 0, 6, -6, 0, 6, 4, 0, -6, 4, 0], [0, 0, 1]);
  receiver([-6, 4, 0, 6, 4, 0, 6, 4, 7, -6, 4, 7], [0, -1, 0]);
  receiver([-6, -6, 0, -6, 4, 0, -6, 4, 7, -6, -6, 7], [1, 0, 0]);
  viewer.add(box(1.4, 1.4, 2.4, [0, 0, 1.2]), { material: { color: '#b9b9b9', roughness: 0.8 }, castShadow: true });
  viewer.add(box(1, 1, 2, [-3, 1, 1]), { material: { color: '#9aaba8', roughness: 0.8 }, castShadow: true });
  marker = viewer.add(box(0.25, 0.25, 0.25, [0, 0, 0]), { material: { color: '#ffe8bd', unlit: true }, bounded: false, castShadow: false, pickable: false });
  viewer.camera.fit({ min: [-6, -6, 0], max: [6, 4, 7] }, viewer.aspect);
  for (const control of controls) {
    control.disabled = false;
    control.addEventListener('input', () => {
      try { updateLight(); } catch (reason) { showError(reason); status.textContent = 'Point light update failed.'; }
    });
  }
  captureButton.disabled = false;
  updateLight();
} catch (reason) {
  if (!closed) { showError(reason); status.textContent = 'The point shadow example could not start.'; }
  cleanup();
}
