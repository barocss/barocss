import {BODY_IDS,validateRecordedFrame} from './recording-reader.mjs';
export const CONTEXT_ID = 'hingeRecordedWorldV1';
export const MOTION_BASIS = Object.freeze({basis:'part-xyz-matches-rhyup'});
export function recordedBindings() {
  return BODY_IDS.map(id => ({contextId:CONTEXT_ID,targetId:id,ref:{modelId:'recorded_'+id,surfaceId:'sphere_witness_'+id}}));
}
export function validateRecordedBindings(bindings) {
  const expected = recordedBindings();
  if (!Array.isArray(bindings) || bindings.length !== 4 || Reflect.ownKeys(bindings).length !== 5)
    throw new RangeError('Recorded hinge bindings are invalid');
  for (let i = 0; i < 4; i++) {
    const b = bindings[i],e = expected[i];
    if (!b || Object.getPrototypeOf(b) !== Object.prototype || Reflect.ownKeys(b).length !== 3 ||
      b.contextId !== e.contextId || b.targetId !== e.targetId || !b.ref || Reflect.ownKeys(b.ref).length !== 2 ||
      b.ref.modelId !== e.ref.modelId || b.ref.surfaceId !== e.ref.surfaceId)
      throw new RangeError('Recorded hinge bindings are invalid');
  }
  return bindings;
}
export function makeViewerFrame(frame,bindings) {
  validateRecordedFrame(frame); validateRecordedBindings(bindings);
  const poses = frame.bodies.map(body => {
    const translation = body.positionM.map(n => n * 1000);
    if (translation.some(n => !Number.isFinite(n) || Math.abs(n) > 10000)) throw new RangeError('Recorded hinge display translation is invalid');
    return {targetId:body.id,translation,rotation:[...body.orientation],scale:[1,1,1]};
  });
  return {contextId:CONTEXT_ID,timeSeconds:frame.timeSeconds,poses};
}
