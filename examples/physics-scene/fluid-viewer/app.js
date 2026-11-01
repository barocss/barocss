import { createViewer } from '../../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../../packages/barocss-cad-interop/dist/model-set.js';
import { waterModelData } from './scene.js';
import { createPhysicsWorld } from '../../../packages/barocss-physics/src/index.ts';
import { createFluidController } from './controller.js';
import { cameraForScene } from './camera.js';

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const toggle = document.querySelector('#toggle');
const stepButton = document.querySelector('#step');
const resetButton = document.querySelector('#reset');
const sceneSelect = document.querySelector('#scene');
const digest = async state => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  state.fluids[0].positionsM.buffer.slice(state.fluids[0].positionsM.byteOffset,
    state.fluids[0].positionsM.byteOffset + state.fluids[0].positionsM.byteLength)))].map(byte =>
      byte.toString(16).padStart(2, '0')).join('');

let viewer;
let controller;
let generation = 0;
let renderVersion = 0;
try {
  const modelSet = await loadBaroCadModelSet({
    format: 'barocad-model-set', version: 0, entries: [{ aliasId: 'fluid_basin',
      url: 'basin.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } }],
  }, { baseURL: location.href });
  viewer = await createViewer(canvas, { mmToSceneUnit: 0.001,
    background: [0.035, 0.065, 0.105] });
  viewer.loadModelSet(modelSet);
  const present = (state, running, reset = false) => {
    if (reset) { viewer.setFluidFrame(null); generation++; }
    viewer.setFluidFrame({ version: 0, contextId: `water_generation_${generation}`,
      sceneRevision: state.identity.modelRevision, stepIndex: state.stepIndex,
      particleCount: state.fluids[0].positionsM.length / 3, positionsM: state.fluids[0].positionsM });
    const accepted = viewer.getState().fluidFrame;
    if (accepted?.stepIndex !== state.stepIndex || accepted.particleCount !== 256) {
      throw new Error('Viewer did not accept the Physics frame');
    }
    toggle.textContent = running ? '일시 정지' : '재생';
    const version = ++renderVersion;
    digest(state).then(sha => {
      if (version !== renderVersion) return;
      status.textContent = `장면: ${sceneSelect.selectedOptions[0].textContent}\n상태: ${running ? '재생' : '일시 정지'}\n단계: ${state.stepIndex}\n시간: ${state.timeSeconds.toFixed(3)} s\n입자: ${state.fluids[0].positionsM.length / 3}\n밀도 오차: ${state.fluids[0].diagnostics.meanAbsoluteDensityError.toFixed(4)}\n경계 접촉: ${state.fluids[0].diagnostics.boundaryHits}\n위치 SHA-256: ${sha}`;
      window.fluidViewerState = { running, stepIndex: state.stepIndex,
        particleCount: state.fluids[0].positionsM.length / 3, sceneRevision: state.identity.modelRevision, sha256: sha,
        diagnostics: { ...state.fluids[0].diagnostics },
        displayStep: accepted.stepIndex };
    }).catch(error => { status.textContent = String(error); });
  };
  const startScene = () => {
    renderVersion++;
    controller?.dispose();
    viewer.setFluidFrame(null);
    generation++;
    const selection = sceneSelect.value;
    viewer.setView(cameraForScene(selection));
    const input = waterModelData({ high: selection.startsWith('splash'), tuned: selection.endsWith('tuned') });
    const world = createPhysicsWorld(input.model, input.options);
    controller = createFluidController(world, input, present);
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
