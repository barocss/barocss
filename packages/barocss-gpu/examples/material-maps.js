const byId = id => document.getElementById(id);
const controls = ['normal', 'roughness', 'metallic', 'strength', 'flip', 'mirror'].map(byId);
const status = byId('status'), error = byId('error'), captureButton = byId('capture');
const textures = [];
let viewer = null, surface = null, captureSession = null, captureEpoch = 0, closed = false, capturing = false;
const baseUVs = [0, 0, 1, 0, 1, 1, 0, 1];

function showError(reason) {
  error.textContent = `${reason.code ? `${reason.code}: ` : ''}${reason.message ?? String(reason)}`;
  error.hidden = false;
}
function cleanup() {
  closed = true; captureEpoch++;
  captureSession?.dispose(); captureSession = null;
  for (const texture of textures) texture.dispose();
  viewer?.dispose();
}
window.addEventListener('beforeunload', cleanup, { once: true });

function dataTexture(kind) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size, i = (y * size + x) * 4;
    if (kind === 'normal') {
      const nx = 0.55 * Math.sin(u * Math.PI * 6), ny = 0.45 * Math.cos(v * Math.PI * 4);
      const nz = Math.sqrt(1 - nx * nx - ny * ny);
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    } else if (kind === 'roughness') data[i + 1] = Math.round(255 * (u < 0.5 ? 0.18 : 0.82));
    else data[i + 2] = v < 0.5 ? 0 : 255;
    data[i + 3] = 255;
  }
  const texture = viewer.createTexture({ width: size, height: size, data }, { srgb: false, mipmaps: false, filter: kind === 'normal' ? 'linear' : 'nearest', wrap: 'repeat' });
  textures.push(texture); return texture;
}

function updateMaterial() {
  captureEpoch++;
  error.hidden = true;
  const strength = Number(byId('strength').value), flip = byId('flip').checked;
  byId('strength-value').value = strength.toFixed(1);
  surface.material = {
    normalMap: byId('normal').checked ? textures[0] : null,
    roughnessMap: byId('roughness').checked ? textures[1] : null,
    metallicMap: byId('metallic').checked ? textures[2] : null,
    normalScale: [strength, flip ? -strength : strength],
  };
  const mirror = byId('mirror').checked;
  surface.geometry.setUVs(baseUVs.map((value, i) => mirror && i % 2 === 0 ? 1 - value : value));
  status.textContent = `Live preview · normal strength ${strength.toFixed(1)} · ${flip ? 'flipped' : '+Y'} normals · ${mirror ? 'mirrored' : 'original'} UVs${capturing ? ' · earlier capture discarded' : ''}`;
}

captureButton.addEventListener('click', async () => {
  if (!viewer || closed || capturing) return;
  const epoch = ++captureEpoch;
  capturing = true; captureButton.disabled = true; error.hidden = true;
  status.textContent = 'Capturing a frozen still · 0 / 8 samples…';
  let session = null;
  try {
    session = await viewer.createPathTrace({ width: 480, height: 360, bounces: 4 });
    captureSession = session;
    if (closed || epoch !== captureEpoch) return;
    await session.sample(8);
    if (closed || epoch !== captureEpoch) return;
    const frame = await session.capture(true);
    if (closed || epoch !== captureEpoch) return;
    if (frame.samples !== 8) throw new Error('This build does not report the captured image sample count. Rebuild the GPU package.');
    const canvas = byId('still');
    canvas.width = frame.width; canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('A 2D canvas context is required to display the captured image.');
    context.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
    byId('capture-caption').textContent = `Frozen still · ${frame.width} × ${frame.height} · ${frame.samples} samples · denoised`;
    byId('capture-output').hidden = false;
    status.textContent = `Captured ${frame.samples} samples. The image remains fixed while you change the live preview.`;
  } catch (reason) {
    if (!closed && epoch === captureEpoch) { showError(reason); status.textContent = 'Capture failed.'; }
  } finally {
    session?.dispose();
    if (captureSession === session) captureSession = null;
    capturing = false;
    captureButton.disabled = closed;
  }
});

try {
  const { createViewer } = await import('../dist/viewer/index.js');
  if (closed) throw new Error('The page closed before the viewer loaded.');
  viewer = await createViewer(byId('view'), {
    pixelRatio: 1, antialias: true, background: '#20242b',
    camera: { position: [0, -0.3, 4], target: [0, 0, 0], up: [0, 1, 0] },
    lights: [
      { kind: 'directional', direction: [-0.6, -0.35, -1], color: '#fff0df', intensity: 2 },
      { kind: 'directional', direction: [0.7, 0.4, -1], color: '#d9e7ff', intensity: 0.45 },
    ],
    environment: { sky: '#cbd9ed', ground: '#302b27', ambient: 0.35, toneMapping: 'aces' },
    onError: reason => { if (!closed) showError(new Error(reason)); },
  });
  if (closed) { viewer.dispose(); throw new Error('The page closed before viewer creation completed.'); }
  const normalMap = dataTexture('normal'), roughnessMap = dataTexture('roughness'), metallicMap = dataTexture('metallic');
  surface = viewer.add({
    positions: [-1.6, -1.2, 0, 1.6, -1.2, 0, 1.6, 1.2, 0, -1.6, 1.2, 0],
    indices: [0, 1, 2, 0, 2, 3], uvs: baseUVs,
  }, { material: { color: '#c58a42', roughness: 1, metallic: 1, normalMap, roughnessMap, metallicMap, normalScale: [1, 1] } });
  if (surface.material.normalMap !== normalMap || surface.material.roughnessMap !== roughnessMap || surface.material.metallicMap !== metallicMap || surface.material.normalScale?.length !== 2) {
    throw new Error('This build does not support material maps. Rebuild the GPU package before using this example.');
  }
  for (const control of controls) {
    control.disabled = false;
    control.addEventListener('input', () => {
      try { updateMaterial(); } catch (reason) { showError(reason); status.textContent = 'Material update failed.'; }
    });
  }
  captureButton.disabled = false;
  updateMaterial();
} catch (reason) {
  if (!closed) { showError(reason); status.textContent = 'The material map example could not start.'; }
  cleanup();
}
