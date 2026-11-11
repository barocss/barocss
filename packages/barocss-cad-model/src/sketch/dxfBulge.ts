import { refusal } from '../engine/refusal';

type Point = [number, number];

/** Decode a DXF polyline segment. A null result is read as a straight segment. */
export function dxfBulge(a: Point, b: Point, bulge: number, type: string): { center: Point; radius: number; sweep: number } | null {
  if (bulge === 0) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord === 0) throw refusal('DXF_MALFORMED', `a ${type} bulge has coincident endpoints`);
  if (!Number.isFinite(chord)) throw refusal('DXF_MALFORMED', `a ${type} bulge has a nonfinite chord`);
  if (Math.abs(bulge) < 1e-12) return null;

  const sweep = 4 * Math.atan(bulge);
  const signedRadius = chord / (2 * Math.sin(sweep / 2));
  const offset = signedRadius * Math.cos(sweep / 2);
  const center: Point = [a[0] / 2 + b[0] / 2 - dy / chord * offset, a[1] / 2 + b[1] / 2 + dx / chord * offset];
  const radius = Math.abs(signedRadius);
  if (!Number.isFinite(radius) || radius === 0 || !center.every(Number.isFinite)) {
    throw refusal('DXF_MALFORMED', `a ${type} bulge cannot produce a finite arc with positive radius`);
  }
  return { center, radius, sweep };
}
