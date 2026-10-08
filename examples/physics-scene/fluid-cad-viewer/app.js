import { createViewer } from '../../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../../packages/barocss-cad-interop/dist/model-set.js';
import { createCadFluidWorld } from '../../../packages/barocss-physics/src/fluid-cad.ts';
import { createWaterWorld, waterScene } from '../fluid-viewer/scene.js';
import { createFluidController } from '../fluid-viewer/controller.js';
import { createTimingRecorder } from './timings.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), status = $('status'), mode = $('mode');
const toggle = $('toggle'), step = $('step'), reset = $('reset'), stale = $('stale');
const sha256 = async positions => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  positions.buffer.slice(positions.byteOffset, positions.byteOffset + positions.byteLength)))].map(
  byte => byte.toString(16).padStart(2, '0')).join('');
const pixelHash = pixels => pixels.reduce((hash, value) =>
  Math.imul(hash ^ value, 16777619) >>> 0, 2166136261);

let viewer, controller, cadWorld;
let generation = 0, renderVersion = 0;
const solverTiming = createTimingRecorder(), renderTiming = createTimingRecorder();
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  renderVersion++;
  controller?.dispose();
  controller = undefined;
  for (const control of [mode, toggle, step, reset, stale]) control.disabled = true;
  status.textContent = 'WebGL2 문맥을 잃었습니다. 복구 후 장면을 다시 만듭니다.';
  window.fluidCadState = { contextLost: true };
});
canvas.addEventListener('webglcontextrestored', () => location.reload());

try {
  const modelSet = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'fluid_shelf', url: 'shelf.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } }],
  }, { baseURL: location.href });
  const source = modelSet.entries[0].result.source;
  const current = { sourceText: source, currentRevision: 'shelfRev1' };
  const request = { sourceVersion: 0, sourceRevision: 'shelfRev1', modelId: 'fluid_shelf',
    surfaceId: 'shelf', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 };
  viewer = createViewer(canvas, { mmToSceneUnit: 0.001,
    background: [0.035, 0.065, 0.105] });
  viewer.loadModelSet(modelSet);
  viewer.setView({ eye: [0.9, 0.85, 1.35], target: [0.35, 0.25, 0.25], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 10 });
  const present = (state, running, resetting = false) => {
    if (resetting) {
      viewer.setFluidFrame(null);
      generation++;
      solverTiming.clear(); renderTiming.clear();
    }
    renderTiming.run(() => viewer.setFluidFrame({ version: 0, contextId: `shelf_generation_${generation}`,
      sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
      particleCount: state.particleCount, positionsM: state.positionsM }));
    const accepted = viewer.getState().fluidFrame;
    if (accepted?.stepIndex !== state.stepIndex || accepted.particleCount !== 256) {
      throw new Error('Viewer did not accept the CAD fluid frame');
    }
    toggle.textContent = running ? '일시 정지' : '재생';
    const version = ++renderVersion;
    sha256(state.positionsM).then(sha => {
      if (version !== renderVersion) return;
      const obstacle = cadWorld?.getObstacle();
      const timing = { solver: solverTiming.summary(), renderSubmit: renderTiming.summary() };
      status.textContent = `모드: ${mode.selectedOptions[0].textContent}\n단계: ${state.stepIndex}\n입자: ${state.particleCount}\n선반 접촉: ${state.obstacleHits ?? 0}\n밀도 오차: ${state.diagnostics.meanAbsoluteDensityError.toFixed(4)}\nSolver p95: ${timing.solver.p95Ms?.toFixed(2) ?? '-'} ms\nViewer 제출 p95: ${timing.renderSubmit.p95Ms?.toFixed(2) ?? '-'} ms\n원본 리비전: shelfRev1\n충돌 ID: ${obstacle?.bodyId ?? '없음'}\n근사: ${obstacle?.lossLabel ?? '충돌 없음'}\n위치 SHA-256: ${sha}`;
      window.fluidCadState = { running, mode: mode.value, sceneRevision: state.sceneRevision,
        stepIndex: state.stepIndex, displayStep: accepted.stepIndex,
        particleCount: state.particleCount, obstacleHits: state.obstacleHits ?? 0,
        density: { ...state.diagnostics }, sha256: sha,
        bodyId: obstacle?.bodyId ?? null, lossLabel: obstacle?.lossLabel ?? null,
        sourceRevision: obstacle?.sourceRevision ?? null,
        timing,
        glError: canvas.getContext('webgl2').getError() };
    }).catch(error => { status.textContent = String(error); });
  };
  const start = () => {
    renderVersion++;
    controller?.dispose();
    viewer.setFluidFrame(null);
    solverTiming.clear(); renderTiming.clear();
    generation++;
    cadWorld = mode.value === 'shelf' ? createCadFluidWorld(waterScene(), source, request) : null;
    const world = cadWorld ?? createWaterWorld();
    controller = createFluidController(cadWorld ? {
      getState: () => world.getState(), step: dt => solverTiming.run(() => world.step(dt, current)),
      reset: () => world.reset(current), dispose: () => world.dispose(),
    } : {
      getState: () => world.getState(), step: dt => solverTiming.run(() => world.step(dt)),
      reset: () => world.reset(), dispose: () => world.dispose(),
    }, present);
    stale.disabled = !cadWorld;
  };
  start();
  mode.addEventListener('change', start);
  toggle.addEventListener('click', () => controller.isRunning() ? controller.pause() : controller.play());
  step.addEventListener('click', () => controller.step());
  reset.addEventListener('click', () => controller.reset());
  stale.addEventListener('click', () => {
    if (!cadWorld) return;
    const previous = cadWorld.getState();
    const beforePixels = pixelHash(viewer.readPixels());
    let refused = false;
    try { cadWorld.step(1 / 120, { sourceText: source, currentRevision: 'shelfRev2' }); }
    catch (error) { refused = error.code === 'STALE_SOURCE'; }
    const next = cadWorld.getState();
    if (!refused || next.stepIndex !== previous.stepIndex
      || next.positionsM.some((value, index) => value !== previous.positionsM[index])
      || pixelHash(viewer.readPixels()) !== beforePixels) {
      throw new Error('Stale CAD source changed the accepted scene');
    }
    window.fluidCadStaleProof = { refused, retainedStep: next.stepIndex,
      retainedPixelHash: beforePixels };
    status.textContent += '\n소스 변경을 거절했고 화면과 Physics 상태를 유지했습니다.';
  });
  window.addEventListener('pagehide', () => { controller?.dispose(); viewer?.dispose(); }, { once: true });
} catch (error) {
  controller?.dispose(); viewer?.dispose();
  status.textContent = `실행 실패: ${error.stack || error.message}`;
}
