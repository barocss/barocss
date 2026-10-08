import { createScene, DT } from './model.js';
import { renderScene } from './render.js';

const $ = (id) => document.getElementById(id);
const scene = await createScene($('viewer'));
let running = true;
let previousTime = 0;
let accumulator = 0;
let message = '';

function show() { renderScene(scene, scene.getState(), running, message); }
function oneStep() {
  if (scene.getState().stepIndex >= 3600) { running = false; show(); return; }
  try {
    scene.step();
    message = '';
  } catch (error) {
    running = false;
    message = error instanceof Error ? error.message : String(error);
  }
  show();
}

$('toggle').addEventListener('click', () => { running = !running; accumulator = 0; show(); });
$('step').addEventListener('click', () => { running = false; oneStep(); });
$('reset').addEventListener('click', () => {
  running = false;
  accumulator = 0;
  scene.reAdmit();
  message = '';
  scene.viewer.fit();
  show();
});
$('fit').addEventListener('click', () => scene.viewer.fit());
$('stale').addEventListener('click', () => {
  running = false;
  const before = JSON.stringify(scene.getState());
  const viewerBefore = JSON.stringify(scene.viewer.getState().motion);
  scene.changeRevision();
  try {
    scene.step();
    message = 'ERROR: stale proxy was accepted';
  } catch (error) {
    const retained = JSON.stringify(scene.getState()) === before
      && JSON.stringify(scene.viewer.getState().motion) === viewerBefore;
    message = retained ? `Refused stale ${scene.sourceRevision}; Physics and Viewer retained state`
      : `ERROR: stale proxy changed accepted state (${error.message})`;
  }
  show();
});
$('readmit').addEventListener('click', () => {
  running = false;
  scene.reAdmit();
  message = `Re-admitted both native Surface proxies at ${scene.sourceRevision}`;
  show();
});

function frame(now) {
  if (previousTime && running) {
    accumulator += Math.min((now - previousTime) / 1000, 0.05) * 0.25;
    while (accumulator >= DT && running) {
      oneStep();
      accumulator -= DT;
    }
  }
  previousTime = now;
  requestAnimationFrame(frame);
}
show();
requestAnimationFrame(frame);
window.physicsCadDemo = { scene, pause: () => { running = false; show(); },
  step: oneStep, reset: () => $('reset').click(),
  stale: () => $('stale').click(), readmit: () => $('readmit').click() };
