import type { PartInstance } from '@barocss/cad-model/engine/doc';
import { placedMassFields, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { matchesNativeMassPatch } from '@barocss/cad-model/engine/nativeMassWire';
export type MassFields = Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'>;
/** O18: the same bodies to draw — each key and mesh as before (only masses may differ). */
export function sameMeshes(a: readonly BodyResult[], b: readonly BodyResult[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].mesh !== b[i].mesh || a[i].key !== b[i].key) return false;
  return true;
}
/** O18: bodies with the masses that came for their refs (placed by their massPlace); the same array when none did. */
export function withMasses(bodies: BodyResult[], got: ReadonlyMap<number, MassFields>): BodyResult[] {
  let out: BodyResult[] | null = null;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i], f = b.massRef !== undefined ? got.get(b.massRef) : undefined; if (!f || !matchesNativeMassPatch(b, f)) continue;
    const { massRef: _ref, massPlace, ...rest } = b; void _ref;
    (out ??= bodies.slice())[i] = { ...rest, ...placedMassFields(f, massPlace ?? []) };
  }
  return out ?? bodies;
}
/** A mesh's content, cheaply (its counts, its bounds and a weighted sum of its positions), once a mesh: the ghost's
 *  "the same body as before" — by its key and this, as the volume told it before masses came after the reply (O18). */
const meshSigs = new WeakMap<object, string>();
export function meshSig(m: BodyResult['mesh']): string {
  let sig = meshSigs.get(m);
  if (sig === undefined) {
    let sum = 0; const p = m.positions;
    for (let i = 0; i < p.length; i++) sum += p[i] * ((i % 7) + 1);
    sig = `${p.length}:${m.indices.length}:${Math.round(sum * 1e3)}`; meshSigs.set(m, sig);
  }
  return sig;
}
/** Whether an instance places the same part the same way (what its evaluation depends on). */
export function samePlacement(a: PartInstance, b: PartInstance): boolean {
  if (a === b) return true;
  if (a.position.some((v, k) => v !== b.position[k]) || a.rotation.some((v, k) => v !== b.rotation[k])) return false;
  return a.doc === b.doc || JSON.stringify(a.doc) === JSON.stringify(b.doc);
}

/** A closed mesh's volume by its triangles (the divergence theorem), for the flow's section check (G19). */
export function meshVolume(m: { positions: Float32Array; indices: Uint32Array }): number {
  let v = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = 3 * m.indices[t], b = 3 * m.indices[t + 1], c = 3 * m.indices[t + 2], P = m.positions;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}
