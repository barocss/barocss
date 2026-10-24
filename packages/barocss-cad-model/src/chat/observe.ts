// What an agent observes of the part (A2.1): after every change, compact facts and how they changed; on request,
// a face's or an edge's detail with its neighbours and the feature that made it. Plain numbers, names and keys:
// no mesh index is exposed.
import { featureLabel, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { nodeIndexOf } from '../engine/ids';
import { materialIdOf } from '../app/bodies';
import { materialOf } from '../library/materials';
import { materialFact } from '../analysis/analysis';
import { roundFaceAxis } from '../app/measure';
import type { Vec3 } from '../engine/mesh';
import { beadAccounting, type BeadAccounting } from '../frames/beadAccounting';
import { r3Signed as r3 } from '../util/round';
import { massGOf } from '../app/mass';

const v3 = (v: readonly number[]) => v.map(r3) as Vec3;

export interface Facts {
  /** Every body built (the kernel refuses what it cannot build: a failed change keeps the part as it was). */
  built: true;
  solids: number; volume: number; mass: number; centroid: Vec3 | null;
  /** Mass/volume are valid body subtotals when the requested beads are incomplete. */
  beadAccounting?: BeadAccounting;
  /** Each body's material; `assumed`: none set, aluminium taken (then `mass_assumed`: the mass is not a measured fact). */
  materials: { body: string; material: string; assumed: boolean }[]; mass_assumed: boolean;
  bbox: { min: Vec3; max: Vec3 } | null;
  faces: number; edges: number; vertices: number;
}

/** A body's corners: the distinct ends of its edges (to 1e-6 mm). */
function vertexCount(b: BodyResult): number {
  const seen = new Set<string>();
  for (const e of b.mesh.edges) for (const p of [e.a, e.b]) seen.add(`${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)},${Math.round(p[2] * 1e6)}`);
  return seen.size;
}

/** The part's facts: solids, volume, mass (each body's material, aluminium by default), centroid, box, counts. */
export function factsOf(doc: StudioDoc, bodies: readonly BodyResult[]): Facts {
  let volume = 0, mass = 0, faces = 0, edges = 0, vertices = 0;
  const c: Vec3 = [0, 0, 0], lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) {
    const v = b.volume ?? 0;
    volume += v; mass += massGOf(v, materialOf(materialIdOf(doc, b)).gPerCm3);
    if (b.centroid) for (let k = 0; k < 3; k++) c[k] += b.centroid[k] * v;
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], b.mesh.bounds.max[k]); }
    faces += b.mesh.faces.length; edges += b.mesh.edges.length; vertices += vertexCount(b);
  }
  const materials = bodies.map(b => ({ body: b.key, ...materialFact(doc, b) }));
  const accounting = beadAccounting(doc, bodies);
  return { built: true, solids: bodies.length, volume: r3(volume), mass: r3(mass), centroid: volume > 0 ? v3(c.map(x => x / volume)) : null, materials, mass_assumed: materials.some(m => m.assumed),
    bbox: bodies.length ? { min: v3(lo), max: v3(hi) } : null, faces, edges, vertices, ...(accounting ? { beadAccounting: accounting } : {}) };
}

/** How the facts changed (only what did; nothing: `{}`). */
export function changeOf(before: Facts, after: Facts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['solids', 'volume', 'mass', 'faces', 'edges', 'vertices'] as const) { const d = r3(after[k] - before[k]); if (d) out[k] = d; }
  if (JSON.stringify(before.bbox) !== JSON.stringify(after.bbox)) out.bbox = after.bbox;
  if (JSON.stringify(before.centroid) !== JSON.stringify(after.centroid)) out.centroid = after.centroid;
  return out;
}

/** The feature a persistent name comes from: its index and label (the newest of an edge's two faces'). */
function madeBy(doc: StudioDoc, name: string): string | undefined {
  const ids = name.split(/[|+]/).map(p => p.split('.')[0]).map(id => nodeIndexOf(doc.nodes, id)).filter(i => i >= 0);
  if (!ids.length) return undefined;
  const i = Math.max(...ids);
  return `${i}: ${featureLabel(doc.nodes[i], i, doc.nodes)}`;
}

/** A face's detail by name: kind, area, normal or axis, radius, centre, its neighbours and the feature that made it. */
export function faceDetail(doc: StudioDoc, bodies: readonly BodyResult[], name: string): Record<string, unknown> | null {
  for (const b of bodies) {
    const f = b.mesh.faces.find(x => x.name.split('+').includes(name)); if (!f) continue;
    const axis = f.kind === 'curved' ? roundFaceAxis(b.mesh, f.index) : null;
    const next = [...new Set(b.mesh.edges.filter(e => e.faces.includes(f.index)).map(e => b.mesh.faces[e.faces[0] === f.index ? e.faces[1] : e.faces[0]]?.name.split('+')[0]).filter((n): n is string => !!n && n !== name))];
    return { name, body: b.key, kind: f.kind, area: r3(f.area), centre: v3(f.centroid),
      ...(f.kind === 'plane' ? { normal: v3(f.normal) } : {}), ...(axis ? { axis: { point: v3(axis.point), direction: v3(axis.dir) } } : {}), ...(f.radius ? { radius: r3(f.radius) } : {}),
      adjacent: next, made_by: madeBy(doc, name) };
  }
  return null;
}

/** An edge's detail by name: its ends, length, line or curve, its two faces and the feature that made it. */
export function edgeDetail(doc: StudioDoc, bodies: readonly BodyResult[], name: string): Record<string, unknown> | null {
  for (const b of bodies) {
    const e = b.mesh.edges.find(x => x.names.includes(name)); if (!e) continue;
    return { name, body: b.key, from: v3(e.a), to: v3(e.b), chord_mm: r3(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2])),
      line: e.straight ? (e.axis ? `along ${e.axis}` : 'oblique') : 'curve', faces: e.faces.map(i => b.mesh.faces[i]?.name.split('+')[0]), made_by: madeBy(doc, name) };
  }
  return null;
}
