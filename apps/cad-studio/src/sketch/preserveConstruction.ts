import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { canonical } from '@barocss/cad-model/util/revision';

function idCounts(shapes: readonly SketchShape[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shape of shapes) {
    for (const id of shape.ids ?? []) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (shape.kind === 'polygon') for (const id of shape.circleIds ?? []) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function legacyOpenConstruction(shape: SketchShape): boolean {
  if (shape.kind !== 'polygon' || !shape.construction || shape.closed || shape.pending || shape.points.length < 2 || shape.ids?.length !== shape.points.length - 1) return false;
  for (const point of shape.points) if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false;
  for (const id of shape.ids) if (!/^e\d+$/.test(id)) return false;
  return true;
}

function comparable(shape: SketchShape, original: SketchShape, ignoreIds = false): string {
  const value = { ...shape };
  if (ignoreIds) delete value.ids;
  // Finish makes open polygons settled. This one transient addition is not an authored edit.
  if (original.kind === 'polygon' && original.pending === undefined && value.kind === 'polygon' && value.pending === false) delete value.pending;
  return canonical(value);
}

/** Keep an untouched legacy construction record during an in-place Finish. New/edited shapes still use withIds.
 * Match ordinal AND unambiguous stable identity plus all authored properties, never geometry alone.
 */
export function preserveConstruction(stored: readonly SketchShape[], authored: readonly SketchShape[], finished: readonly SketchShape[]): SketchShape[] {
  const refs: SketchShape[] = [];
  for (const shape of authored) if (shape.construction || shape.kind === 'bezier') refs.push(shape);
  if (!stored.length || refs.length !== finished.length) return [...finished];
  const oldCounts = idCounts(stored), currentCounts = idCounts(authored), result = [...finished];
  for (let i = 0; i < refs.length; i++) {
    const original = stored[i], current = refs[i], final = finished[i];
    if (!original || !legacyOpenConstruction(original)) continue;
    let unique = true;
    for (const id of original.ids!) if (oldCounts.get(id) !== 1 || currentCounts.get(id) !== 1) { unique = false; break; }
    if (!unique || comparable(current, original) !== comparable(original, original)) continue;
    if (comparable(final, original, true) !== comparable(original, original, true)) continue;
    result[i] = original;
  }
  return result;
}
