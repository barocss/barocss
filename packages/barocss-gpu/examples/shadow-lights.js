const byId = id => document.getElementById(id);
const controls = ['red-shadow', 'green-shadow', 'red-intensity', 'green-intensity', 'soft', 'angle'].map(byId);
const status = byId('status'), error = byId('error'), captureButton = byId('capture');
let viewer = null, closed = false, capturing = false, epoch = 0;

function showError(reason) {
  error.textContent = `${reason.code ? `${reason.code}: ` : ''}${reason.message ?? String(reason)}`;
  error.hidden = false;
}
function cleanup() { closed = true; epoch++; viewer?.dispose(); }
window.addEventListener('beforeunload', cleanup, { once: true });

function updateLights() {
  epoch++;
  const red = Number(byId('red-intensity').value), green = Number(byId('green-intensity').value);
  const redShadow = byId('red-shadow').checked, greenShadow = byId('green-shadow').checked;
  const angle = byId('soft').checked ? Number(byId('angle').value) : 0;
  viewer.lights = [
    { kind: 'directional', direction: [0.85, 0.2, -1], color: '#ff3030', intensity: red, castShadow: redShadow },
    { kind: 'directional', direction: [-0.85, 0.2, -1], color: '#30ff60', intensity: green, castShadow: greenShadow },
  ];
  viewer.environment = { ambient: 0.08, sky: '#ffffff', ground: '#ffffff', toneMapping: 'none', softShadows: angle };
  viewer.requestRender();
  byId('red-value').value = red.toFixed(1); byId('green-value').value = green.toFixed(1);
  byId('angle-value').value = `${byId('angle').value}°`; byId('angle').disabled = !byId('soft').checked;
  error.hidden = true;
  status.textContent = `Red shadow ${redShadow ? 'on' : 'off'} · green shadow ${greenShadow ? 'on' : 'off'} · ${angle ? `soft, ${angle}°` : 'hard edges'}${capturing ? ' · earlier capture discarded' : ''}`;
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
    status.textContent = 'Preview captured. Change a shadow switch to compare the live view.';
  } catch (reason) {
    if (!closed && capturedEpoch === epoch) { showError(reason); status.textContent = 'Capture failed.'; }
  } finally { capturing = false; captureButton.disabled = closed; }
});

try {
  const { createViewer } = await import('../dist/viewer/index.js');
  if (closed) throw new Error('The page closed before the viewer loaded.');
  viewer = await createViewer(byId('view'), {
    pixelRatio: 1, antialias: true, background: '#20242b',
    camera: { position: [8, -11, 10], target: [0, 0, 0.8], up: [0, 0, 1] },
    onError: message => { if (!closed) showError(new Error(message)); },
  });
  if (closed) { viewer.dispose(); throw new Error('The page closed before viewer creation completed.'); }
  viewer.add({ positions: [-6, -5, 0, 6, -5, 0, 6, 5, 0, -6, 5, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
    { material: { color: '#dddddd', roughness: 1 }, castShadow: false });
  const positions = [], normals = [], indices = [], half = [0.7, 0.7, 1.6];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 0, 0], n = [0, 0, 0]; p[axis] = sign * half[axis]; p[u] = a * half[u]; p[v] = b * half[v] * sign; p[2] += half[2]; n[axis] = sign;
      positions.push(...p); normals.push(...n);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  viewer.add({ positions, normals, indices }, { material: { color: '#d3d3d3', roughness: 0.7 }, castShadow: true });
  viewer.camera.fit({ min: [-4.8, -3, 0], max: [4.8, 3, 3.2] }, viewer.aspect);
  for (const control of controls) {
    control.disabled = false;
    control.addEventListener('input', () => {
      try { updateLights(); } catch (reason) { showError(reason); status.textContent = 'Shadow update failed.'; }
    });
  }
  captureButton.disabled = false;
  updateLights();
} catch (reason) {
  if (!closed) { showError(reason); status.textContent = 'The directional shadow example could not start.'; }
  cleanup();
}
