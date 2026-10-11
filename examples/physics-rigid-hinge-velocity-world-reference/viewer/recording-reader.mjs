export const BODY_IDS = Object.freeze(['pairA0', 'pairB0', 'pairA1', 'pairB1']);
export const JOINT_IDS = Object.freeze(['hinge0', 'hinge1']);
export const FRAME_COUNT = 1201;
export const RECORDED_DT = 1 / 120;
export const MAX_RECORDING_BYTES = 12 * 1024 * 1024;
export const RECORDING_ERRORS = Object.freeze({data: 'Recorded hinge data is invalid', frame: 'Recorded hinge frame is invalid', index: 'Recorded hinge frame index is invalid', hash: 'Recorded hinge data hash differs'});
const fail = key => { throw new RangeError(RECORDING_ERRORS[key]); };
const copy = value => structuredClone(value);
function fields(value, keys, error = 'frame') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length) fail(error);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !d.enumerable || !('value' in d)) fail(error);
  }
}
function dense(value, n) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== n ||
    Reflect.ownKeys(value).length !== n + 1) fail('frame');
  for (let i = 0; i < n; i++) if (!Object.hasOwn(value, i)) fail('frame');
}
function vector(v, n) { dense(v, n); if (v.some(x => typeof x !== 'number' || !Number.isFinite(x))) fail('frame'); }
function finiteTree(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean' || typeof v === 'string' || v === null) return true;
  if (Array.isArray(v)) { dense(v, v.length); return v.every(finiteTree); }
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype)
    return Object.keys(v).every(key => finiteTree(v[key]));
  return false;
}
export function zeroPaths(value, prefix = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? [prefix] : [];
  if (value === null || typeof value !== 'object') return [];
  return Object.keys(value).flatMap(key => zeroPaths(value[key], prefix + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1')));
}
export function restoreZeros(root, paths) {
  dense(paths, paths.length);
  if (new Set(paths).size !== paths.length) fail('frame');
  for (const path of paths) {
    if (typeof path !== 'string' || !path.startsWith('/') || /~(?![01])/u.test(path)) fail('frame');
    const parts = path.slice(1).split('/').map(x => x.replaceAll('~1', '/').replaceAll('~0', '~'));
    let parent = root;
    for (const key of parts.slice(0, -1)) {
      const d = parent && Object.getOwnPropertyDescriptor(parent, key);
      if (!d || !('value' in d) || d.value === null || typeof d.value !== 'object') fail('frame');
      parent = d.value;
    }
    const key = parts.at(-1), d = parent && Object.getOwnPropertyDescriptor(parent, key);
    if (!d || !('value' in d) || typeof d.value !== 'number' || d.value !== 0) fail('frame');
    parent[key] = -0;
  }
}
function rawHex(bodies) {
  const bytes = new Uint8Array(416), view = new DataView(bytes.buffer); let cursor = 0;
  for (const body of bodies) for (const number of [...body.positionM, ...body.velocityMps, ...body.orientation, ...body.angularVelocityRadps]) {
    view.setFloat64(cursor, number, true); cursor += 8;
  }
  return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
}
const MOTOR_KEYS = ['inputAngleRad','targetSpeedRadps','limitRad','maxImpulseNms','blocked','impulseNms','relativeSpeedBeforeRadps','relativeSpeedAfterRadps'];
const REPORT_KEYS = ['id','kind','aId','bId','angleRad','linearImpulseNs','angularImpulseNms','motorImpulseNms'];
const PAIR_KEYS = ['jointId','aId','bId','acceptedReportAngleRad','rawSourceAngleRad','rawFreeAngleRad','rawPostContactAngleRad','rawFinalAngleRad','motor','jointReport','bodyCorrections','energyByPhase','work','reportCap'];
export function validateRecordedFrame(frame) {
  fields(frame, ['stepIndex','timeSeconds','bodies','joints','pairs','rawBodiesHex','negativeZeroPaths','source']);
  if (!Number.isSafeInteger(frame.stepIndex) || frame.stepIndex < 0 || frame.stepIndex >= FRAME_COUNT ||
    frame.timeSeconds !== frame.stepIndex * RECORDED_DT) fail('frame');
  dense(frame.bodies, 4); dense(frame.joints, 2);
  for (let i = 0; i < 4; i++) {
    const body = frame.bodies[i]; fields(body, ['id','kind','shape','positionM','velocityMps','orientation','angularVelocityRadps','inertiaKgM2']);
    if (body.id !== BODY_IDS[i] || body.kind !== 'dynamic' || typeof body.inertiaKgM2 !== 'number' || !Number.isFinite(body.inertiaKgM2) || body.inertiaKgM2 <= 0) fail('frame');
    fields(body.shape, ['kind','radiusM']); if (body.shape.kind !== 'sphere' || body.shape.radiusM !== .1) fail('frame');
    vector(body.positionM,3); vector(body.velocityMps,3); vector(body.orientation,4); vector(body.angularVelocityRadps,3);
    if (body.orientation.some(n => Math.abs(n) > 1) || Math.abs(Math.hypot(...body.orientation) - 1) > 1e-9) fail('frame');
  }
  for (let i = 0; i < 2; i++) {
    const j = frame.joints[i]; fields(j, REPORT_KEYS);
    if (j.id !== JOINT_IDS[i] || j.kind !== 'hinge' || j.aId !== BODY_IDS[i*2] || j.bId !== BODY_IDS[i*2+1]) fail('frame');
    vector(j.linearImpulseNs,3); vector(j.angularImpulseNms,3);
    if (![j.angleRad,j.motorImpulseNms].every(n => typeof n === 'number' && Number.isFinite(n))) fail('frame');
  }
  if (frame.stepIndex === 0) { if (frame.pairs !== null) fail('frame'); }
  else {
    dense(frame.pairs,2);
    for (let i = 0; i < 2; i++) {
      const p = frame.pairs[i]; fields(p, PAIR_KEYS);
      if (p.jointId !== JOINT_IDS[i] || p.aId !== BODY_IDS[i*2] || p.bId !== BODY_IDS[i*2+1] || !finiteTree(p)) fail('frame');
      fields(p.motor,MOTOR_KEYS); fields(p.jointReport,REPORT_KEYS);
      fields(p.energyByPhase,['sourceJ','angularJ','motorJ','freeJ','postContactJ','projectedJ']);
      fields(p.work,['externalAngularByBodyJ','externalAngularTotalJ','motorMidpointJ','motorSpinMidpointJ','motorResidualJ','freeDeltaKJ','projectionDeltaKJ','projectionObjectiveJ','contactDeltaKJ']);
      fields(p.reportCap,['angularReactionNormNms','maxReactionNms','exceedsCap']);
      dense(p.bodyCorrections,2);
      for (const key of ['acceptedReportAngleRad','rawSourceAngleRad','rawFreeAngleRad','rawPostContactAngleRad','rawFinalAngleRad'])
        if (typeof p[key] !== 'number' || !Number.isFinite(p[key])) fail('frame');
      for (const key of ['inputAngleRad','targetSpeedRadps','maxImpulseNms','impulseNms','relativeSpeedBeforeRadps','relativeSpeedAfterRadps'])
        if (typeof p.motor[key] !== 'number' || !Number.isFinite(p.motor[key])) fail('frame');
      vector(p.motor.limitRad,2); if (typeof p.motor.blocked !== 'boolean') fail('frame');
      for (const value of Object.values(p.energyByPhase)) if (typeof value !== 'number' || !Number.isFinite(value)) fail('frame');
      vector(p.work.externalAngularByBodyJ,2);
      for (const [key,value] of Object.entries(p.work)) if (key !== 'externalAngularByBodyJ' && (typeof value !== 'number' || !Number.isFinite(value))) fail('frame');
      if (typeof p.reportCap.angularReactionNormNms !== 'number' || !Number.isFinite(p.reportCap.angularReactionNormNms) ||
        typeof p.reportCap.maxReactionNms !== 'number' || !Number.isFinite(p.reportCap.maxReactionNms) || typeof p.reportCap.exceedsCap !== 'boolean') fail('frame');
      if (JSON.stringify(p.jointReport) !== JSON.stringify(frame.joints[i])) fail('frame');
      for (let j=0;j<2;j++) { const correction=p.bodyCorrections[j]; fields(correction,['bodyId','linearImpulseNs','angularImpulseNms']);
        if (correction.bodyId !== BODY_IDS[i*2+j]) fail('frame'); vector(correction.linearImpulseNs,3); vector(correction.angularImpulseNms,3); }
    }
  }
  if (typeof frame.rawBodiesHex !== 'string' || !/^[0-9a-f]{832}$/u.test(frame.rawBodiesHex) || rawHex(frame.bodies) !== frame.rawBodiesHex ||
    JSON.stringify(zeroPaths(frame)) !== JSON.stringify(frame.negativeZeroPaths)) fail('frame');
  fields(frame.source,['native','raw']); fields(frame.source.native,['offset','bytes','sha256','acceptedStore']);
  fields(frame.source.raw,['offset','bytes','sha256','phase']);
  for (const source of [frame.source.native,frame.source.raw]) if (!Number.isSafeInteger(source.offset) || source.offset < 0 ||
    !Number.isSafeInteger(source.bytes) || source.bytes <= 0 || !/^[0-9a-f]{64}$/u.test(source.sha256)) fail('frame');
  if (frame.source.raw.bytes !== 416 || frame.source.native.acceptedStore !== (frame.stepIndex === 0 ? 'before' : 'after') ||
    frame.source.raw.phase !== (frame.stepIndex === 0 ? 'initial' : 'projected')) fail('frame');
  return frame;
}
function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
export function validateRecording(input) {
  fields(input,['version','dt','bodyIds','jointIds','provenance','frames'],'data');
  if (input.version !== 1 || input.dt !== RECORDED_DT || JSON.stringify(input.bodyIds) !== JSON.stringify(BODY_IDS) ||
    JSON.stringify(input.jointIds) !== JSON.stringify(JOINT_IDS)) fail('data');
  dense(input.bodyIds,4); dense(input.jointIds,2);
  fields(input.provenance,['nativeWorld','consumerHead','sourceManifestSha256','sourceFreezeSha256','emittedLedgerSha256','sourceFiles','initialDiagnosticsRecorded','physicsRerun'],'data');
  if (input.provenance.nativeWorld !== 'f40123da0eedb19245688557f865e1beb09d47ef' ||
    input.provenance.sourceManifestSha256 !== '60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191' ||
    input.provenance.initialDiagnosticsRecorded !== false || input.provenance.physicsRerun !== false) fail('data');
  dense(input.frames,FRAME_COUNT); const data = copy(input);
  data.frames.forEach((frame,i) => { restoreZeros(frame,frame.negativeZeroPaths); validateRecordedFrame(frame); if (frame.stepIndex !== i) fail('data'); });
  freeze(data);
  return Object.freeze({...data,frameFor(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= FRAME_COUNT) fail('index');
    return copy(data.frames[index]);
  }});
}
export async function loadRecordedData(url) {
  const response = await fetch(url); if (!response.ok) throw new Error('Recorded hinge data could not be loaded');
  const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > MAX_RECORDING_BYTES) fail('data');
  const receiptUrl = new URL('extraction-receipt.json', new URL(url,globalThis.location?.href ?? 'http://localhost/'));
  const receiptResponse = await fetch(receiptUrl); if (!receiptResponse.ok) fail('hash');
  const receipt = await receiptResponse.json();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), n => n.toString(16).padStart(2,'0')).join('');
  if (receipt.status !== 'PASS' || receipt.output.bytes !== bytes.length || receipt.output.sha256 !== hash) fail('hash');
  return validateRecording(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
