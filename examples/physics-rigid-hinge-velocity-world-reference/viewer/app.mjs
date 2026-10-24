import {createViewer} from '@barocss/viewer';
import {loadRecordedData, validateRecordedFrame} from './recording-reader.mjs';
import {createRecordedPackets, DISPLAY_PALETTE} from './meshes.mjs';
import {makeViewerFrame} from './frame.mjs';
import {createRecordedController, errorDiagnostic} from './controller.mjs';

const CAMERA = Object.freeze({eye: [1.4, 1.2, 1.9], target: [0, 0, .5], up: [0, 1, 0], fovY: 45, near: .01, far: 10});
const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const ids = ['pairA0', 'pairB0', 'pairA1', 'pairB1'];
const fields = [
  ['angleRad', '보고 각도', 'rad'], ['rawFinalAngleRad', '기하 각도', 'rad'],
  ['motorImpulseNms', '모터 임펄스', 'N·m·s'], ['motorBlocked', '모터 차단', ''],
  ['angularReactionNormNms', '보정 상한 비교값', 'N·m·s'], ['maxReactionNms', '보정 상한', 'N·m·s'],
  ['motorMidpointJ', '모터 일', 'J'], ['projectionDeltaKJ', '보정 에너지 변화', 'J'],
  ['bodyALinearImpulseNs', 'A 선형 보정', 'N·s'], ['bodyAAngularImpulseNms', 'A 각 보정', 'N·m·s'],
  ['bodyBLinearImpulseNs', 'B 선형 보정', 'N·s'], ['bodyBAngularImpulseNms', 'B 각 보정', 'N·m·s'],
];
function numberText(value) {
  if (Object.is(value, -0)) return '−0';
  return Math.abs(value) !== 0 && Math.abs(value) < .00001 ? value.toExponential(3) : value.toPrecision(6).replace(/(\.[0-9]*?[1-9])0+$|\.0+$/, '$1');
}
const encoded = value => Object.is(value, -0) ? '-0' : String(value);
function valueCell(element, value) {
  element.dataset.available = value === null || value === undefined ? 'false' : 'true';
  delete element.dataset.value; delete element.dataset.values;
  if (element.dataset.available === 'false') { element.textContent = '기록 없음'; return; }
  if (Array.isArray(value)) { element.dataset.values = '[' + value.map(encoded).join(',') + ']'; element.textContent = value.map(numberText).join(', '); }
  else { element.dataset.value = encoded(value); element.textContent = typeof value === 'boolean' ? value ? '예' : '아니요' : numberText(value); }
}
for (const [index, id] of ['hinge0', 'hinge1'].entries()) {
  const card = document.createElement('section'); card.className = 'joint'; card.dataset.jointId = id;
  const title = document.createElement('h3'); title.textContent = `${id} · pairA${index} / pairB${index}`; card.append(title);
  const grid = document.createElement('dl');
  for (const [field, label, unit] of fields) {
    const name = document.createElement('dt'); name.textContent = label + (unit ? ` (${unit})` : '');
    const cell = document.createElement('dd'); cell.dataset.field = field; cell.textContent = '기록 없음'; grid.append(name, cell);
  }
  card.append(grid); document.querySelector('#joints').append(card);
}
for (const [index, id] of ids.entries()) {
  const row = document.createElement('tr'); row.dataset.bodyId = id;
  for (const text of [id, '', '', '']) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
  const dot = document.createElement('span'); dot.className = 'body-color'; dot.style.backgroundColor = `rgb(${DISPLAY_PALETTE[index].map(value => Math.round(value * 255)).join(',')})`; dot.setAttribute('aria-hidden', 'true'); row.firstChild.prepend(dot);
  document.querySelector('#bodies').append(row);
}

window.hingeRecordedReady = false;
let controller = null;
window.addEventListener('pagehide', () => controller?.dispose());

window.hingeRecordedReadyPromise = (async () => {
  const recording = await loadRecordedData(new URL('./recording.json', import.meta.url));
  const geometry = createRecordedPackets();
  function render(snapshot) {
    const frame = snapshot.cursor === null ? null : recording.frameFor(snapshot.cursor);
    document.querySelector('#step').textContent = snapshot.cursor === null ? '—' : String(snapshot.cursor);
    document.querySelector('#time').textContent = frame ? frame.timeSeconds.toFixed(6) + ' s' : '—';
    document.querySelector('#cursor').value = String(snapshot.cursor ?? 0);
    document.querySelector('#limit').textContent = snapshot.cursor !== null && snapshot.cursor >= 197 ? '관절 한계: 197번째 기록에서 도달' : '관절 한계: 아직 도달 전';
    status.textContent = snapshot.disposed ? '화면 종료' : !snapshot.displayKnown ? '표시 상태 불명 · 마지막 확인 기록을 유지합니다.' : snapshot.playing ? '기록 재생 중' : snapshot.ended ? '기록 재생 완료 · 1200 / 10 s' : '기록 일시 정지';
    document.querySelector('#error').textContent = snapshot.errors.at(-1)?.message ?? '';
    document.querySelector('#play').disabled = !snapshot.displayKnown || snapshot.disposed || snapshot.ended || snapshot.playing;
    document.querySelector('#pause').disabled = !snapshot.playing;
    document.querySelector('#one-step').disabled = !snapshot.displayKnown || snapshot.disposed || snapshot.ended;
    document.querySelector('#reset').disabled = snapshot.disposed;
    document.querySelector('#cursor').disabled = snapshot.disposed;
    if (!frame) return;
    for (let index = 0; index < 2; index++) {
      const pair = frame.pairs?.[index], joint = frame.joints[index];
      const values = {angleRad: joint.angleRad, rawFinalAngleRad: pair?.rawFinalAngleRad,
        motorImpulseNms: joint.motorImpulseNms, motorBlocked: pair?.motor.blocked,
        angularReactionNormNms: pair?.reportCap.angularReactionNormNms, maxReactionNms: pair?.reportCap.maxReactionNms,
        motorMidpointJ: pair?.work.motorMidpointJ, projectionDeltaKJ: pair?.work.projectionDeltaKJ,
        bodyALinearImpulseNs: pair?.bodyCorrections[0].linearImpulseNs, bodyAAngularImpulseNms: pair?.bodyCorrections[0].angularImpulseNms,
        bodyBLinearImpulseNs: pair?.bodyCorrections[1].linearImpulseNs, bodyBAngularImpulseNms: pair?.bodyCorrections[1].angularImpulseNms};
      const card = document.querySelector(`[data-joint-id="hinge${index}"]`);
      for (const [field] of fields) valueCell(card.querySelector(`[data-field="${field}"]`), values[field]);
    }
    for (const body of frame.bodies) {
      const cells = document.querySelector(`[data-body-id="${body.id}"]`).children;
      cells[1].textContent = body.positionM.map(numberText).join(', ');
      cells[2].textContent = body.velocityMps.map(numberText).join(', ');
      cells[3].textContent = body.angularVelocityRadps.map(numberText).join(', ');
    }
  }
  controller = createRecordedController({recording, validateFrame: validateRecordedFrame, makeViewerFrame, onChange: render,
    async createSession() {
      const viewer = await createViewer(canvas, {mmToSceneUnit: .001, background: [.055, .075, .105]});
      try { viewer.setPackets(geometry.packets); viewer.setView(structuredClone(CAMERA)); }
      catch (error) { viewer.dispose(); throw error; }
      return {viewer, bindings: geometry.bindings};
    }});
  window.hingeRecordedProof = Object.freeze({
    seek: index => controller.seek(index), oneStep: () => controller.oneStep(), reset: () => controller.reset(),
    play: () => controller.play(), pause: () => controller.pause(), dispose: () => controller.dispose(),
    getSnapshot: () => controller.getSnapshot(), getClockStats: () => controller.getClockStats(),
    getViewerState: () => controller.getViewerState(), getRecordingFrame: index => controller.getRecordingFrame(index),
    readPixels: () => controller.readPixels(), getCanvas: () => canvas,
  });
  document.querySelector('#play').addEventListener('click', () => controller.play());
  document.querySelector('#pause').addEventListener('click', () => controller.pause());
  document.querySelector('#one-step').addEventListener('click', () => controller.oneStep());
  document.querySelector('#reset').addEventListener('click', () => controller.reset());
  document.querySelector('#cursor').addEventListener('input', event => controller.seek(Number(event.currentTarget.value)));
  if (!(await controller.initialize())) throw new Error('Recorded Viewer initial submission failed');
  window.hingeRecordedReady = true;
  return controller.getSnapshot();
})().catch(error => { const diagnostic = errorDiagnostic(error); window.hingeRecordedStartupError = {name: diagnostic.name, message: diagnostic.message}; status.textContent = '기록 화면을 시작하지 못했습니다.'; document.querySelector('#error').textContent = '자료 또는 화면 초기화 오류. 오류 기록을 확인하세요.'; throw error; });
