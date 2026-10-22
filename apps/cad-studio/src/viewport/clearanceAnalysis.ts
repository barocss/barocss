import { CLEARANCE_MAP_VERSION, applyFill, type ClearanceMap, type ClearancePair, type OverlapFill, type PlacedBody } from '@barocss/cad-model/team/clearanceMap';
import { multiply } from '@barocss/gpu/viewer';
import { motionOf, poseMatrix } from './instancePose';
import { placedBase, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { ClearanceDisplay, ClearanceOverlay } from './clearanceDisplay';

/** Match the viewport's origin subassembly without flattening the root a second time. */
export function clearanceSourceDocument(doc: StudioDoc): StudioDoc {
  return { ...doc, instances: doc.instances?.filter(inst => !inst.hidden).map(inst => ({ ...inst, doc: placedBase(inst, doc) })) };
}
/** Placed display keys can change after transforms. Instance visibility uses its stable owner ID. */
export function visibleClearanceBodies(bodies: readonly PlacedBody[], rootKeys: readonly string[], instanceIds: readonly string[]): PlacedBody[] {
  const roots = new Set(rootKeys), ids = [...instanceIds].sort((a, b) => b.length - a.length);
  return bodies.filter(body => ids.some(id => body.key.startsWith(id + '/')) || roots.has(body.key));
}

/** Display transforms follow placement, then the current joint/explode/drag motion. Local Model data stays local. */
export function posedClearanceBodies(bodies: readonly PlacedBody[], motions: ReadonlyMap<string, Float64Array>, instanceIds: readonly string[]): PlacedBody[] {
  const ids = [...instanceIds].sort((a, b) => b.length - a.length);
  return bodies.map(body => {
    const owner = ids.find(id => body.key.startsWith(id + '/')), motion = motions.get(owner ?? body.key);
    if (!motion) return body;
    const placement = poseMatrix({ R: Float64Array.from(body.pose.m), t: Float64Array.from(body.pose.t) }, undefined), result = motionOf(multiply(motion, placement));
    return { ...body, pose: { m: Array.from(result.R), t: [result.t[0], result.t[1], result.t[2]] } };
  });
}
/** Model applyFill checks pose; the consumer additionally checks generation, version and revision. */
export function acceptClearanceFill(map: ClearanceMap, fill: OverlapFill, request: number, currentRequest: number): boolean {
  if (request !== currentRequest || map.version !== CLEARANCE_MAP_VERSION || map.revision !== fill.revision) return false;
  const pair = map.pairs.find(p => p.a === fill.a && p.b === fill.b);
  if (!pair || pair.pose !== fill.pose) return false;
  return applyFill(map, fill);
}
export function clearancePairState(pair: ClearancePair): ClearanceOverlay['state'] {
  return pair.overlap && 'refused' in pair.overlap ? 'refused' : pair.overlap && 'pending' in pair.overlap ? 'pending' : pair.state;
}
const palette: Record<ClearanceOverlay['state'], readonly [number, number, number]> = {
  overlap: [0.94, 0.13, 0.12], contact: [0.96, 0.64, 0.18], pending: [0.96, 0.64, 0.18], refused: [1, 0.12, 0.12],
  touching: [0.26, 0.66, 0.94], designed: [0.13, 0.72, 0.54], near: [0.98, 0.54, 0.12], clear: [0.35, 0.64, 0.8],
};
function normalsOf(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const x = positions[b] - positions[a], y = positions[b + 1] - positions[a + 1], z = positions[b + 2] - positions[a + 2], u = positions[c] - positions[a], v = positions[c + 1] - positions[a + 1], w = positions[c + 2] - positions[a + 2];
    const n = [y * w - z * v, z * u - x * w, x * v - y * u];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) normals[i + k] += n[k];
  }
  for (let i = 0; i < normals.length; i += 3) { const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1; for (let k = 0; k < 3; k++) normals[i + k] /= length; }
  return normals;
}
/** Vertex colours consume only the Model's independent band field; display tessellation indices are not substituted. */
export function clearanceOverlays(map: ClearanceMap, bodies: readonly PlacedBody[]): ClearanceOverlay[] {
  const overlays: ClearanceOverlay[] = [];
  const add = (pair: ClearancePair, side: string, body: PlacedBody | undefined, positions: Float32Array, indices: Uint32Array, field?: Float32Array) => {
    if (!body || !indices.length) return;
    const state = clearancePairState(pair), colors = new Float32Array(positions.length), base = palette[state];
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      const fraction = state === 'near' && field ? Math.min(1, Math.max(0, field[vertex] / map.near.mm)) : 0;
      colors.set([base[0], base[1] + fraction * 0.28, base[2]], vertex * 3);
    }
    overlays.push({ id: `${pair.a}|${pair.b}|${side}`, bodyKey: body.key, positions, indices, colors, normals: normalsOf(positions, indices), field,
      model: poseMatrix({ R: Float64Array.from(body.pose.m), t: Float64Array.from(body.pose.t) }, undefined), state, hatched: state === 'refused', opacity: state === 'pending' ? 0.38 : 0.65 });
  };
  for (const pair of map.pairs) {
    const a = bodies.find(body => body.key === pair.a), b = bodies.find(body => body.key === pair.b);
    if (pair.band) { add(pair, 'band-a', a, pair.band.a.positions, pair.band.a.indices, pair.band.a.field); add(pair, 'band-b', b, pair.band.b.positions, pair.band.b.indices, pair.band.b.field); }
    if (pair.overlap && 'mesh' in pair.overlap && pair.overlap.volumeMM3 > 0) add(pair, 'overlap-a', a, pair.overlap.mesh.positions, pair.overlap.mesh.indices);
  }
  return overlays;
}
export function clearanceDisplay(map: ClearanceMap, bodies: readonly PlacedBody[], request: number, stage: ClearanceDisplay['stage']): ClearanceDisplay {
  return { version: map.version, request, revision: map.revision, nearMM: map.near.mm, stage, pairs: map.pairs, overlays: clearanceOverlays(map, bodies) };
}
