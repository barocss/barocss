// A part's cut list (FR4a, D127): every frame member's body as a piece, in its own material (its look's, else the part's),
// grouped by the kernel. The studio's densities are the materials library's — every one an estimate (D67) — so the list
// says so.
import { cutList, type CutList } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { bodyName, materialIdOf } from './bodies';
import { MATERIALS } from './materials';

export interface PartCutList extends CutList {
  /** Each piece's body key and its name, as the rows list them. */
  readonly names: Readonly<Record<string, string>>;
  /** The materials' densities are estimates (the library's, not the user's stock). */
  readonly densityEstimate: true;
}

/** The cut list of the part's frame members, or null when it has none. `fallback`: the part's material id. */
export function partCutList(doc: StudioDoc, bodies: readonly BodyResult[], fallback?: string): PartCutList | null {
  const members = bodies.filter(b => b.cutPiece);
  if (!members.length) return null;
  const base = MATERIALS.find(m => m.id === fallback) ?? MATERIALS[0], names: Record<string, string> = {};
  const pieces = members.map(b => {
    const mat = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? base;
    names[b.key] = bodyName(doc, b);
    return { ...b.cutPiece!, id: b.key, material: mat.label, densityKgPerM3: mat.gPerCm3 * 1000 };
  });
  return { ...cutList(pieces, { densityKgPerM3: base.gPerCm3 * 1000, material: base.label }), names, densityEstimate: true };
}
