import type { SnapPoint } from '@barocss/cad-model/sketch/osnap';

export const OBJECT_SNAP_KINDS = [
  { kind: 'end', label: 'Endpoint' },
  { kind: 'mid', label: 'Midpoint' },
  { kind: 'centre', label: 'Centre' },
  { kind: 'quadrant', label: 'Quadrant' },
  { kind: 'origin', label: 'Origin' },
  { kind: 'crossing', label: 'Edge crossing' },
] as const;

export type ObjectSnapKind = (typeof OBJECT_SNAP_KINDS)[number]['kind'];
export type ObjectSnapKinds = ReadonlySet<ObjectSnapKind>;

export function defaultObjectSnapKinds(): ObjectSnapKinds {
  return new Set(OBJECT_SNAP_KINDS.map(item => item.kind));
}

export function toggleObjectSnapKind(current: ObjectSnapKinds, kind: ObjectSnapKind): ObjectSnapKinds {
  const next = new Set(current);
  if (!next.delete(kind)) next.add(kind);
  return next;
}

export function enabledObjectSnaps(points: readonly SnapPoint[], kinds: ObjectSnapKinds | undefined): readonly SnapPoint[] {
  return kinds ? points.filter(point => point.kind !== 'calculated' && kinds.has(point.kind)) : points;
}
