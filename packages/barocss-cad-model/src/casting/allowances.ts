// IM8b (O108): a casting pattern's allowances, from the process's tables as a page prints them (NPTEL's metal casting
// lectures 3 and 4: shrinkage in inches per foot by the pattern dimension's band in feet, machining in inches by the
// dimension's band in inches) or the user's own (`doc.casting`). The dimension is the part's largest extent; one
// shrinkage scales the whole pattern (a uniform scale keeps exact planes and cylinders exact; a per-dimension one would
// not). The machining allowance goes on the faces the user marks as machined, flat ones only.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { machiningClassOf, type CastFamily, type ProcessProfile } from '../library/materials';

export const FT_MM = 304.8, IN_MM = 25.4;
export type Allowance<T> = ({ ok: true } & T) | { ok: false; why: string };
export interface ShrinkAllowance { readonly ratio: number; readonly basis: 'table' | 'set'; readonly band: string; readonly label: string; readonly page: string | null }
export interface MachiningAllowance { readonly mm: number; readonly basis: 'table' | 'set'; readonly band: string; readonly label: string; readonly page: string | null }
export interface MachinedFace { readonly name: string; readonly body: string; readonly flat: boolean }

const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** An allowance found, without its `ok`. */
export const shrinkView = ({ ok: _, ...s }: { ok: true } & ShrinkAllowance): ShrinkAllowance => s;
export const machiningView = ({ ok: _, ...m }: { ok: true } & MachiningAllowance): MachiningAllowance => m;
/** The part's box and its largest extent (mm). */
export function partExtent(bodies: readonly BodyResult[]): { min: number[]; max: number[]; largestMM: number } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.mesh.bounds.max[k]); }
  return { min, max, largestMM: Math.max(...[0, 1, 2].map(k => max[k] - min[k])) };
}
/** A band's words as the page has them: "up to 4 ft", "2 ft to 4 ft", "over 6 ft". */
function bandWords(lo: number | null, hi: number | null, unit: string): string {
  return hi === null ? `over ${lo} ${unit}` : lo === null ? `up to ${hi} ${unit}` : `${lo} ${unit} to ${hi} ${unit}`;
}

/** The shrinkage for a family at the part's size: the user's ratio, else the table's band (the band's top included). */
export function shrinkOf(doc: StudioDoc, profile: ProcessProfile, family: CastFamily, sizeMM: number): Allowance<ShrinkAllowance> {
  const set = doc.casting?.shrink;
  if (typeof set === 'number') return { ok: true, ratio: set, basis: 'set', band: 'yours', label: 'your shrinkage', page: null };
  const row = profile.allowances?.shrink.find(s => s.family === family);
  if (!row) return { ok: false, why: `no ${profile.label.toLowerCase()} shrinkage for a ${family} alloy was read from a public page: set yours (set_casting shrink)` };
  const ft = sizeMM / FT_MM, k = row.bands.findIndex(b => b.upToFt === null || ft <= b.upToFt + 1e-12), b = row.bands[k];
  return { ok: true, ratio: b.inPerFt / 12, basis: 'table', band: bandWords(k ? row.bands[k - 1].upToFt : null, b.upToFt, 'ft'), label: row.label, page: row.page.url };
}
/** The machining allowance for a family at the part's size: the user's, else the table's (none past its last band). */
export function machiningOf(doc: StudioDoc, profile: ProcessProfile, family: CastFamily, sizeMM: number): Allowance<MachiningAllowance> {
  const set = doc.casting?.machiningAllowanceMM;
  if (typeof set === 'number') return { ok: true, mm: set, basis: 'set', band: 'yours', label: 'your allowance', page: null };
  const cls = machiningClassOf(family), row = profile.allowances?.machining.find(m => m.class === cls);
  if (!row) return { ok: false, why: `no ${profile.label.toLowerCase()} machining allowance for ${cls === 'nonferrous' ? 'a non-ferrous metal' : `cast ${cls}`} was read from a public page: set yours (set_casting allowance)` };
  const inch = sizeMM / IN_MM, k = row.bands.findIndex(b => inch <= b.upToIn + 1e-12);
  if (k < 0) return { ok: false, why: `the part's ${r6(sizeMM)} mm is past the table's last band (${row.bands.at(-1)!.upToIn} in): set yours (set_casting allowance)` };
  const b = row.bands[k];
  return { ok: true, mm: r6(b.in * IN_MM), basis: 'table', band: bandWords(k ? row.bands[k - 1].upToIn : null, b.upToIn, 'in'), label: row.label, page: row.page.url };
}
/** The faces marked machined, each found on a body or not, and whether it is flat (the ones an allowance goes on). */
export function machinedFaces(doc: StudioDoc, bodies: readonly BodyResult[]): { found: MachinedFace[]; missing: string[] } {
  const found: MachinedFace[] = [], missing: string[] = [];
  for (const name of doc.casting?.machined ?? []) {
    const hit = bodies.flatMap(b => b.mesh.faces.filter(f => f.name === name).map(f => ({ name, body: b.key, flat: f.kind === 'plane' })))[0];
    if (hit) found.push(hit); else missing.push(name);
  }
  return { found, missing };
}
