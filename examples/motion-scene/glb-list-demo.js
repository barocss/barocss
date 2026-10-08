import { bakeMotionGlbAnimation, listMotionGlbAnimations, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const status = document.getElementById('status');
const catalog = document.getElementById('animations');
const select = document.getElementById('select');
const pose = document.getElementById('pose');

try {
  const response = await fetch('./assets/gltf-interpolation-test/InterpolationTest.glb');
  if (!response.ok) throw new Error('GLB request failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const summaries = listMotionGlbAnimations(bytes);
  const selected = summaries.find((item) => item.name === 'CubicSpline Rotation');
  if (!selected || selected.channels.length !== 1) throw new Error('Cubic rotation selection unavailable');
  for (const item of summaries) {
    const row = document.createElement('li');
    row.dataset.animationIndex = String(item.animationIndex);
    const name = document.createElement('strong');
    name.textContent = `${item.animationIndex}. ${item.name ?? 'Unnamed'}`;
    const detail = document.createElement('span');
    detail.textContent = item.channels.map((channel) =>
      `node ${channel.nodeIndex} · ${channel.path} · ${channel.interpolation}`).join(', ');
    row.append(name, detail);
    catalog.append(row);
  }
  select.disabled = false;
  status.textContent = `${summaries.length} animations discovered; select index ${selected.animationIndex}`;
  document.body.dataset.ready = 'true';
  select.addEventListener('click', () => {
    try {
      const clip = bakeMotionGlbAnimation(bytes, {
        animationIndex: selected.animationIndex,
        contextId: 'discovered-cubic',
        nodeTargets: selected.channels.map((channel) => ({ nodeIndex: channel.nodeIndex, targetId: 'rotating-box' })),
        frame: 'gltf-y-up-as-part-xyz', subdivisionsPerInterval: 4,
      });
      const selectedPose = sampleMotionClip(clip, 0.125).poses[0];
      pose.textContent = JSON.stringify({
        targetId: selectedPose.targetId,
        rotationXYZW: selectedPose.rotation.map((value) => +value.toFixed(7)),
        bakedKeys: clip.tracks[0].keys.length,
      }, null, 2);
      catalog.querySelector(`[data-animation-index="${selected.animationIndex}"]`).classList.add('selected');
      status.textContent = `Index ${selected.animationIndex} baked and sampled at 0.125 s`;
    } catch (error) {
      status.textContent = `Selection refused: ${error.message}`;
    }
  });
} catch (error) {
  status.textContent = `List refused: ${error.message}`;
  console.error(error);
}
