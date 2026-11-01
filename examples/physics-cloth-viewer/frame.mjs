import { copyPhysicsModelPreset } from '../physics-model-data-2276/model-data.mjs';
export const DT = 1 / 120, STEPS = 240;

export function clothModelData() {
  const input = copyPhysicsModelPreset('cloth-pinned-sphere-visual-v1');
  input.model.revision = 'clothRev981';
  return input;
}

/** Public Viewer DTO. Metres remain metres; the Viewer performs the unit conversion. */
export function frameFromState(state, generation, model) {
  return {
    version: 0, layerId: 'cloth_sheet_981', contextId: `cloth_host_gen_${generation}`,
    sceneRevision: state.identity.modelRevision, stepIndex: state.stepIndex,
    vertexCount: state.cloths[0].positionsM.length / 3, triangleCount: model.cloths[0].triangles.length,
    positionsM: state.cloths[0].positionsM.slice(), triangles: Uint16Array.from(model.cloths[0].triangles.flat()),
  };
}

export function copyData(value) {
  if (value instanceof Float64Array || value instanceof Uint16Array) return value.slice();
  if (Array.isArray(value)) return value.map(copyData);
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) result[key] = copyData(value[key]);
    return result;
  }
  return value;
}

/** Compare every accepted nested field and typed numeric bit, including signed zero. */
export function sameState(left, right) {
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right) || left.constructor !== right.constructor ||
        left.byteLength !== right.byteLength) return false;
    const a = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
    const b = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
    for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
    return true;
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return Object.is(left, right);
  const a = Object.keys(left), b = Object.keys(right);
  return a.length === b.length && a.every(key => Object.hasOwn(right, key) && sameState(left[key], right[key]));
}
