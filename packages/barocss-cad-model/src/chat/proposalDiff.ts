// G12 (O136; the S0, O129, approved): what a proposal adds and removes, for the GPU lane's two-colour overlay. Each
// side's bodies are united (the base before, the proposal after), then removed = before − after and added =
// after − before by the kernel's analytic Boolean — whatever the body keys (a union node keys its body anew though its
// material hardly changes) — each drawn as a body is (its display mesh). The faces, by persistent name: added, removed,
// or changed in geometry (area, centroid or exact surface), always given whole, so where the Boolean refuses (facet or
// mixed bodies, until the kernel's F3) the overlay can tint faces instead (`method: 'faces'`, with why).
// Scope v1: the base part's geometry; a proposal's placed-part changes are its parts' labels, not diffed in geometry.
import { booleanAnalytic, brepMassProperties, type Brep } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { partBreps, type BodyResult } from '../engine/evaluate';
import { bodyMesh, type DisplayFace, type DisplayMesh } from '../engine/mesh';
import { proposalParts, type ProposalPart } from './tools';

export interface Material { mesh: DisplayMesh; volumeMM3: number }
export interface ChangedFace { name: string; kind: 'added' | 'removed' | 'changed' }
export interface ProposalDiff {
  /** The material the proposal adds, and the material it takes away (null: none). */
  added: Material | null; removed: Material | null;
  /** Every face added, removed or changed in geometry, by persistent name. */
  changedFaces: ChangedFace[];
  /** The proposal's features (for labels: proposalParts). */
  parts: ProposalPart[];
  /** How `added` and `removed` were had: the Boolean of both sides, or not (`faces`: only the faces, with why). */
  method: 'boolean' | 'faces'; why?: string;
}
/** A side: a document and its evaluated bodies. */
export interface Side { doc: StudioDoc; bodies: readonly BodyResult[] }

/** How much work the diffs did (the cache's test reads it). */
export const diffWork = { booleans: 0 };
const QUALITY = 8;
/** A face's geometry, rounded past single precision: equal when the face did not change. */
const geometryOf = (f: DisplayFace) => JSON.stringify([+f.areaMM2.toPrecision(9), f.centroid.map(v => +v.toFixed(5)), f.exact ? Object.values(f.exact).map(x => Array.isArray(x) ? x.map(v => +v.toFixed(9)) : +(+x).toFixed(9)) : null]);
function facesOf(bodies: readonly BodyResult[]): Map<string, string> {
  const out = new Map<string, string[]>();
  for (const b of bodies) for (const f of b.mesh.faces) { const list = out.get(f.name) ?? []; list.push(geometryOf(f)); out.set(f.name, list); }
  return new Map([...out].map(([k, v]) => [k, v.sort().join('|')]));
}
/** The faces added, removed and changed from one side to the other (whole, whichever method). */
export function changedFaces(before: readonly BodyResult[], after: readonly BodyResult[]): ChangedFace[] {
  const a = facesOf(before), b = facesOf(after), out: ChangedFace[] = [];
  for (const [name, g] of b) { const was = a.get(name); if (was === undefined) out.push({ name, kind: 'added' }); else if (was !== g) out.push({ name, kind: 'changed' }); }
  for (const name of a.keys()) if (!b.has(name)) out.push({ name, kind: 'removed' });
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

const unite = (doc: StudioDoc): Brep | null => {
  const bs = partBreps(doc).map(b => b.brep); if (!bs.length) return null;
  let u = bs[0]; for (let k = 1; k < bs.length; k++) { diffWork.booleans++; u = booleanAnalytic(u, bs[k], 'union'); }
  return u;
};
const material = (r: Brep | null): Material | null => r && r.bodies.length ? { mesh: bodyMesh(r, 0, QUALITY), volumeMM3: brepMassProperties(r, 1).volumeMM3 } : null;
const minus = (a: Brep, b: Brep) => { diffWork.booleans++; return material(booleanAnalytic(a, b, 'difference')); };

/** What the proposal (`proposed`) adds to and takes from the base part (`base`). */
export function proposalDiff(base: Side, proposed: Side): ProposalDiff {
  const faces = changedFaces(base.bodies, proposed.bodies), parts = proposalParts(base.doc, proposed.doc);
  try {
    const A = unite(base.doc), B = unite(proposed.doc);
    const removed = A && B ? minus(A, B) : material(A), added = A && B ? minus(B, A) : material(B);
    return { added, removed, changedFaces: faces, parts, method: 'boolean' };
  } catch (e) {
    return { added: null, removed: null, changedFaces: faces, parts, method: 'faces', why: e instanceof Error ? e.message : String(e) };
  }
}

/** The last diffs, by the base's revision and the proposal: a proposal hovered twice is not worked out twice. */
const cache = new Map<string, ProposalDiff>();
const CACHED = 8;
/** `proposalDiff`, kept by (the base's revision, the proposal's id). */
export function proposalDiffFor(key: { revision: string; proposal: string }, base: Side, proposed: Side): ProposalDiff {
  const k = `${key.revision}|${key.proposal}`, hit = cache.get(k);
  if (hit) { cache.delete(k); cache.set(k, hit); return hit; }
  const d = proposalDiff(base, proposed);
  cache.set(k, d);
  if (cache.size > CACHED) cache.delete(cache.keys().next().value!);
  return d;
}
