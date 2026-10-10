export const DT = 1 / 120, STEPS = 240;

export function scene() {
  return {
    format: 'barocss-cloth-scene', version: 1, revision: 'clothRev981',
    basis: 'right-handed-xyz-metres', fixedStepSeconds: DT, profile: 'pinned-sheet-sphere-v1',
  };
}

/** Public Viewer DTO. Metres remain metres; the Viewer performs the unit conversion. */
export function frameFromState(state, generation) {
  return {
    version: 0, layerId: 'cloth_sheet_981', contextId: `cloth_host_gen_${generation}`,
    sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
    vertexCount: state.vertexCount, triangleCount: state.triangleCount,
    positionsM: state.positionsM.slice(), triangles: state.triangles.slice(),
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
