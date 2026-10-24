// A part's faces as mates read them: each persistent face name with its exact plane, cylinder, sphere or cone, and its
// straight and circular edges (O24 c), in the part's own coordinates, from the kernel's B-rep (not the display mesh,
// which is single precision).
import { evaluateCadPart, faceGeometry, type Brep } from '@barocss/cad';
import { curvedFace, edgeKey, edgePoints, edgeShape, loopPoints, mergeEdges, planeMoment } from './shapes';
import { withBeadRetry } from '../engine/part';
import { contentKey } from '../engine/evalMemo';
import type { StudioDoc } from '../engine/doc';
import { BASE, type FaceTable, type MateFace, type Vec3 } from './mates';
import { clean } from '../engine/placement';
import { datumWorld, readReferences } from '../chat/references';

/** Values within a nanometre of a round number are that number (a circle read back from its NURBS). */
const snap = (p: readonly number[]): Vec3 => [clean(p[0]), clean(p[1]), clean(p[2])];
const snapUnit = (p: readonly number[]): Vec3 => {
  const q = p.map(v => clean(v, 1e-12)), l = Math.hypot(q[0], q[1], q[2]);
  return [q[0] / l, q[1] / l, q[2] / l];
};

/** A part's origin planes as mate faces: `origin:xy` faces +Z, `origin:xz` +Y, `origin:yz` +X. */
export const ORIGIN_PLANES: FaceTable = {
  'origin:xy': { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] },
  'origin:xz': { kind: 'plane', point: [0, 0, 0], normal: [0, 1, 0] },
  'origin:yz': { kind: 'plane', point: [0, 0, 0], normal: [1, 0, 0] },
};

/**
 * The flat and cylindrical faces of a part by name (pieces of one face, `x#1` and `x#2`, read as `x`). Cached by the
 * part's content: an evaluation fills it from the B-rep it built (rememberFaceTable, PERF3 A1); otherwise reading it
 * evaluates the part here (about a second for a 16-hole plate: on the main thread, once per content).
 */
export function faceTableOf(doc: StudioDoc): FaceTable {
  if (!doc.nodes.length) return { ...ORIGIN_PLANES };
  const key = faceKey(doc), have = tableCache.get(key);
  if (have) return have;
  let outputs;
  try { outputs = withBeadRetry(doc, part => evaluateCadPart(part)).outputs; } catch { return { ...ORIGIN_PLANES }; }
  const table = faceTableFrom(outputs);
  remember(key, table);
  return table;
}
/** A part's evaluation's face table, kept for faceTableOf (by the part's content). */
export function rememberFaceTable(doc: StudioDoc, table: FaceTable): void { if (doc.nodes.length) remember(faceKey(doc), table); }
function remember(key: string, table: FaceTable) { tableCache.set(key, table); if (tableCache.size > 32) tableCache.delete(tableCache.keys().next().value!); }
/**
 * The face table of a part's outputs (their B-reps): flat and round faces, spheres and cones (O24 c), a flat face's
 * centroid and a round face's or a cone's extent along its axis, and its straight and circular edges by name (the
 * pieces of one edge, `x|y#1` and `x|y#2`, read as `x|y` when they are one circle or one line; else each by its own).
 */
export function faceTableFrom(outputs: readonly { readonly brep: Brep }[]): FaceTable {
  // Every part's origin planes (in its own coordinates) mate like flat faces.
  const table: FaceTable = { ...ORIGIN_PLANES };
  const moments = new Map<string, { area: number; moment: Vec3 }>(), spans = new Map<string, [number, number]>(), edges = new Map<string, { raw: string; shape: MateFace }[]>();
  for (const o of outputs) {
    const b = o.brep, loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), edgePts = new Map<string, Vec3[]>();
    for (const e of b.edges) edgePts.set(e.id, edgePoints(e));
    for (const f of b.faces) {
      const name = (f.name ?? f.id).replace(/#\d+$/, '');
      if (!table[name]) {
        try {
          const g = faceGeometry(f);
          if (g.kind === 'plane') table[name] = { kind: 'plane', point: snap(g.o), normal: snapUnit(g.n) };
          else if (g.kind === 'cylinder') table[name] = { kind: 'cylinder', point: snap(g.c), axis: snapUnit(g.a), radius: clean(g.r), outer: g.out > 0 };
          else { const c = curvedFace(f); if (c) table[name] = c; }
        } catch { /* a general surface: not mateable */ }
      }
      const entry = table[name];
      if (!entry || entry.kind === 'sphere' || name.startsWith('origin:')) continue;
      const rings: { pts: Vec3[]; outer: boolean }[] = [];
      for (const id of f.loops) { const l = loops.get(id)!; rings.push({ pts: loopPoints(b, l, coedges, edgePts), outer: l.kind === 'outer' }); }
      if (entry.kind === 'plane') {
        const m = planeMoment(rings, entry.normal), had = moments.get(name);
        moments.set(name, had ? { area: had.area + m.area, moment: [had.moment[0] + m.moment[0], had.moment[1] + m.moment[1], had.moment[2] + m.moment[2]] } : m);
      } else if (entry.kind === 'cylinder' || entry.kind === 'cone') {
        let [lo, hi] = spans.get(name) ?? [Infinity, -Infinity];
        for (const r of rings) for (const p of r.pts) { const t = (p[0] - entry.point[0]) * entry.axis[0] + (p[1] - entry.point[1]) * entry.axis[1] + (p[2] - entry.point[2]) * entry.axis[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
        spans.set(name, [lo, hi]);
      }
    }
    for (const e of b.edges) {
      const key = e.name ? edgeKey(e.name) : null, shape = key ? edgeShape(edgePts.get(e.id)!, e.vertices[0] === e.vertices[1]) : null;
      if (key && shape) (edges.get(key) ?? edges.set(key, []).get(key)!).push({ raw: e.name!, shape });
    }
  }
  for (const [name, m] of moments) { const f = table[name]; if (f.kind === 'plane' && Math.abs(m.area) > 1e-12) table[name] = { ...f, centre: snap([m.moment[0] / m.area, m.moment[1] / m.area, m.moment[2] / m.area]) }; }
  for (const [name, sp] of spans) { const f = table[name]; if ((f.kind === 'cylinder' || f.kind === 'cone') && sp[0] <= sp[1]) table[name] = { ...f, span: [clean(sp[0]), clean(sp[1])] }; }
  // (An edge's pieces: one entry when they are one circle or one line, else each by its own name.)
  for (const [key, pieces] of edges) {
    let one: MateFace | null = pieces[0].shape;
    for (let k = 1; one && k < pieces.length; k++) one = mergeEdges(one, pieces[k].shape);
    if (one) table[key] = one; else for (const p of pieces) table[p.raw] = p.shape;
  }
  return table;
}

/** What a part's faces depend on: its nodes and parameters. */
/** The key face tables are kept by: the part's nodes and parameters (each node's text kept per node object, long arrays by their digest). */
export const faceKey = (doc: StudioDoc) => contentKey(doc);

// Face tables by part content (reading them evaluates the part), shared by mates, the chat's assembly tools,
// stored references' signatures (engine/references.ts), the requirement checks and the print rules.
const tableCache = new Map<string, FaceTable>();
/** A part's face table, cached by its content (the same as faceTableOf). */
export function tableOf(doc: StudioDoc): FaceTable {
  return faceTableOf(doc);
}
/** The face tables of a document's parts: the base part's own, an instance's by its id. */
export const tablesFor = (doc: StudioDoc) => (part: string): FaceTable | undefined => {
  const d = part === BASE ? doc : doc.instances?.find(i => i.id === part)?.doc;
  return d ? (part === BASE ? withDatums(tableOf(d), doc) : tableOf(d)) : undefined;
};
/**
 * The base part's datums as mate targets (A6.3, O75): `datum:<id>`, where its locked reference puts it — a plane datum
 * a flat face, an axis datum a round one (an axis to put a shaft on, radius its fitted one or 0). Point datums do not mate.
 */
export function withDatums(table: FaceTable, doc: StudioDoc): FaceTable {
  const set = readReferences(doc.references);
  if (!set.datums.length) return table;
  const out: FaceTable = { ...table };
  for (const d0 of set.datums) {
    const d = datumWorld(set, d0);
    if (d.kind === 'plane' && d.normal) out[`datum:${d.id}`] = { kind: 'plane', point: snap(d.origin), normal: snapUnit(d.normal) };
    else if (d.kind === 'axis' && d.direction) out[`datum:${d.id}`] = { kind: 'cylinder', point: snap(d.origin), axis: snapUnit(d.direction), radius: d.radius ?? 0, outer: false };
  }
  return out;
}

