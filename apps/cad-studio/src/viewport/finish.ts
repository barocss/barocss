// G15a: an appearance's finish, clear coat and oil film as the viewer's material takes them. A turned or knurled finish
// centres on its body (its mesh's box), so rings and a knurl sit on the part wherever it is modelled; none clears them.
import type { Material } from '@barocss/gpu/viewer';
import type { Appearance } from '@barocss/cad-model/engine/render';

const NO_FINISH: Pick<Material, 'finish' | 'clearcoat' | 'film'> = { finish: null, clearcoat: 0, film: 0 };
/** (Each mesh's box centre, once: a mesh's positions don't change.) */
const centres = new WeakMap<ArrayLike<number>, [number, number, number]>();

function centreOf(positions: ArrayLike<number>): [number, number, number] {
  let c = centres.get(positions);
  if (!c) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = positions[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    c = positions.length ? [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] : [0, 0, 0];
    centres.set(positions, c);
  }
  return c;
}

/** The finish part of a body's material for its look (none: cleared), `positions` the body's mesh in its own frame. */
export function finishOf(look: Appearance | null, positions: ArrayLike<number> | null): Pick<Material, 'finish' | 'clearcoat' | 'film'> {
  if (!look || (!look.finish && !look.clearcoat && !look.film)) return NO_FINISH;
  const f = look.finish;
  return {
    finish: f ? { kind: f.kind, scale: f.scale, strength: f.strength, axis: f.axis ?? [0, 0, 1], origin: positions ? centreOf(positions) : [0, 0, 0] } : null,
    clearcoat: look.clearcoat ?? 0, film: look.film ?? 0,
  };
}
