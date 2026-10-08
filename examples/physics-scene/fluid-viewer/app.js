import { createViewer } from '../../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../../packages/barocss-cad-interop/dist/model-set.js';
import { createWaterWorld } from './scene.js';
import { createFluidController } from './controller.js';

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const toggle = document.querySelector('#toggle');
const stepButton = document.querySelector('#step');
const resetButton = document.querySelector('#reset');
const sceneSelect = document.querySelector('#scene');
const digest = async state => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  state.positionsM.buffer.slice(state.positionsM.byteOffset,
    state.positionsM.byteOffset + state.positionsM.byteLength)))].map(byte =>
      byte.toString(16).padStart(2, '0')).join('');

let viewer;
let controller;
let generation = 0;
let renderVersion = 0;
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  renderVersion++;
  controller?.dispose();
  controller = undefined;
  for (const control of [toggle, stepButton, resetButton, sceneSelect]) control.disabled = true;
  status.textContent = 'WebGL2 문맥을 잃었습니다. 복구 후 장면을 다시 만듭니다.';
  window.fluidViewerState = { contextLost: true };
});
canvas.addEventListener('webglcontextrestored', () => location.reload());
try {
  const modelSet = await loadBaroCadModelSet({
    format: 'barocad-model-set', version: 0, entries: [{ aliasId: 'fluid_surface',
      url: 'occluder.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } }],
  }, { baseURL: location.href });
  viewer = createViewer(canvas, { mmToSceneUnit: 0.001,
    background: [0.035, 0.065, 0.105] });
  viewer.loadModelSet(modelSet);
  viewer.setView({ eye: [0.35, 0.65, 2], target: [0.35, 0.5, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 10 });
  const present = (state, running, reset = false) => {
    if (reset) { viewer.setFluidFrame(null); generation++; }
    viewer.setFluidFrame({ version: 0, contextId: `water_generation_${generation}`,
      sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
      particleCount: state.particleCount, positionsM: state.positionsM });
    const accepted = viewer.getState().fluidFrame;
    if (accepted?.stepIndex !== state.stepIndex || accepted.particleCount !== 256) {
      throw new Error('Viewer did not accept the Physics frame');
    }
    toggle.textContent = running ? '일시 정지' : '재생';
    const version = ++renderVersion;
    digest(state).then(sha => {
      if (version !== renderVersion) return;
      status.textContent = `장면: ${sceneSelect.selectedOptions[0].textContent}\n상태: ${running ? '재생' : '일시 정지'}\n단계: ${state.stepIndex}\n시간: ${state.timeSeconds.toFixed(3)} s\n입자: ${state.particleCount}\n밀도 오차: ${state.diagnostics.meanAbsoluteDensityError.toFixed(4)}\n경계 접촉: ${state.diagnostics.boundaryHits}\n위치 SHA-256: ${sha}`;
      window.fluidViewerState = { running, stepIndex: state.stepIndex,
        particleCount: state.particleCount, sceneRevision: state.sceneRevision, sha256: sha,
        diagnostics: { ...state.diagnostics },
        displayStep: accepted.stepIndex, glError: canvas.getContext('webgl2').getError() };
    }).catch(error => { status.textContent = String(error); });
  };
  const startScene = () => {
    renderVersion++;
    controller?.dispose();
    viewer.setFluidFrame(null);
    generation++;
    const selection = sceneSelect.value;
    controller = createFluidController(createWaterWorld({
      high: selection.startsWith('splash'), tuned: selection.endsWith('tuned'),
    }), present);
  };
  startScene();
  sceneSelect.addEventListener('change', startScene);
  toggle.addEventListener('click', () => controller.isRunning() ? controller.pause() : controller.play());
  stepButton.addEventListener('click', () => controller.step());
  resetButton.addEventListener('click', () => controller.reset());
  window.addEventListener('pagehide', () => { controller?.dispose(); viewer?.dispose(); }, { once: true });
} catch (error) {
  controller?.dispose(); viewer?.dispose();
  status.textContent = `실행 실패: ${error.stack || error.message}`;
}
