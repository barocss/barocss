import { compileCadModel, evaluateCurve, evaluateSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

export const options = Object.freeze({ sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: Object.freeze({ version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 }),
  nativeCapacity: Object.freeze({ version: 1, maximumObjects: 16 }) });
export const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
export const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, i) => Object.is(value, b[i]));
export function requireFact(fact, message) { if (!fact) throw new Error(message); }
export function nativePreview(source, item) {
  const cold = compileCadModel(source, { sourceVersion: 0 });
  requireFact(cold.ok && cold.model.objects.length === 5 && same(cold.model.objects.map(x => x.id), item.ids),
    `Whole native Model mismatch: ${item.key}`);
  const seed = cold.model.objects[0];
  const seedPoints = seed.kind === 'curve' ? seed.controlPoints : seed.controlPoints.flat();
  for (const [index, native] of cold.model.objects.entries()) {
    const points = native.kind === 'curve' ? native.controlPoints : native.controlPoints.flat();
    const matrix = item.matrices[index];
    requireFact(same({ ...native, id: seed.id, controlPoints: seed.controlPoints }, seed) &&
      points.length === seedPoints.length && points.every((point, p) => point.every((value, axis) =>
        Math.abs(value - (matrix[axis * 4] * seedPoints[p][0] + matrix[axis * 4 + 1] * seedPoints[p][1] +
          matrix[axis * 4 + 2] * seedPoints[p][2] + matrix[axis * 4 + 3])) < 1e-11)),
      `Native member basis/matrix mismatch: ${item.key}/${native.id}`);
  }
  const neutral = parseBaroCadSource(source, options);
  requireFact(neutral.source === source && same(neutral.model, cold.model), `Native authority mismatch: ${item.key}`);
  for (const preview of neutral.curves) {
    const native = cold.model.objects.find(x => x.id === preview.curveId);
    for (const [index, parameter] of preview.sample.parameters.entries()) {
      const point = evaluateCurve(native, parameter);
      requireFact(point.every((value, axis) => Math.abs(value - preview.sample.pointsMM[index][axis]) < 1e-11 &&
        Object.is(Math.fround(preview.sample.pointsMM[index][axis] * 0.001), preview.positions[index * 3 + axis])),
        `Native Curve parameters/units mismatch: ${item.key}/${native.id}`);
    }
  }
  for (const preview of neutral.surfaces) {
    const native = cold.model.objects.find(x => x.id === preview.surfaceId);
    requireFact(preview.report.vertexCount === 64 && preview.report.triangleCount === 98 &&
      sameBuffer(preview.mesh.parameters, Float32Array.from(preview.packet.parameters)), `Surface native UV mismatch: ${item.key}/${native.id}`);
    for (let index = 0; index < 64; index++) {
      const point = evaluateSurface(native, preview.packet.parameters[index * 2], preview.packet.parameters[index * 2 + 1]);
      requireFact(point.every((value, axis) => Math.abs(value - preview.packet.positions[index * 3 + axis]) < 1e-11 &&
        Object.is(Math.fround(preview.packet.positions[index * 3 + axis] * 0.001), preview.mesh.positions[index * 3 + axis])),
        `Native Surface parameters/units mismatch: ${item.key}/${native.id}`);
    }
  }
  return neutral;
}
export const pixelHash = bytes => bytes.reduce((hash, byte) => Math.imul(hash ^ byte, 16777619) >>> 0, 2166136261);
export const coloredPixels = bytes => {
  let count = 0;
  for (let i = 0; i < bytes.length; i += 4)
    if (bytes[i] !== 20 || bytes[i + 1] !== 34 || bytes[i + 2] !== 54) count++;
  return count;
};
