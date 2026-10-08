const $ = (id) => document.getElementById(id);
const yPixels = (metres) => 390 - metres * 1100;

export function renderScene(scene, state, running, message = '') {
  const [movingProxy, fixedProxy] = scene.proxies;
  const body = state.bodies.find((entry) => entry.id === movingProxy.bodyId);
  const fixture = state.bodies.find((entry) => entry.id === fixedProxy.bodyId);
  const contact = state.contacts.find((entry) => [entry.aId, entry.bId].includes(body.id)
    && [entry.aId, entry.bId].includes(fixture.id));
  const radius = movingProxy.body.shape.radiusM;
  const floorHalf = fixedProxy.body.shape.halfExtentsM[1];
  const top = yPixels(fixture.positionM[1] + floorHalf);
  const bottom = yPixels(fixture.positionM[1] - floorHalf);
  $('proxy-ball').setAttribute('cy', yPixels(body.positionM[1]).toFixed(3));
  $('proxy-ball').setAttribute('r', (radius * 1100).toFixed(3));
  $('proxy-center').setAttribute('y1', yPixels(body.positionM[1]).toFixed(3));
  $('proxy-center').setAttribute('y2', yPixels(body.positionM[1]).toFixed(3));
  $('proxy-floor').setAttribute('y', top.toFixed(3));
  $('proxy-floor').setAttribute('height', (bottom - top).toFixed(3));
  $('proxy-floor-top').setAttribute('d', `M125 ${top.toFixed(3)}H235`);
  $('proxy-ball').classList.toggle('touching', Boolean(contact));
  $('contact-indicator').classList.toggle('touching', Boolean(contact));
  $('height').textContent = body.positionM[1].toFixed(4);
  $('velocity').textContent = body.velocityMps[1].toFixed(4);
  $('step-index').textContent = String(state.stepIndex);
  $('sim-time').textContent = state.timeSeconds.toFixed(3);
  $('source-revision').textContent = scene.sourceRevision;
  $('proxy-ids').textContent = `${movingProxy.bodyId} · ${fixedProxy.bodyId}`;
  $('loss-label').textContent = `${movingProxy.lossLabel} ${fixedProxy.lossLabel}`;
  $('proxy-radius').textContent = radius.toFixed(5);
  $('contact').textContent = contact
    ? `${contact.aId} ↔ ${contact.bId} · ${contact.impulseNs.toFixed(4)} N·s`
    : 'No contact in this step';
  $('mode').textContent = running ? 'RUNNING' : 'PAUSED';
  $('mode').classList.toggle('paused', !running);
  $('toggle').textContent = running ? 'Pause' : 'Continue';
  $('error').textContent = message;
  $('error').classList.toggle('ok', message.startsWith('Refused'));
}
