// A part's faces as mates read them: each persistent face name with its exact plane or cylinder, in the
// part's own coordinates, from the kernel's B-rep (not the display mesh, which is single precision).
import { evaluateCadPart, faceGeometry, type Brep } from '@barocss/cad';
import { withBeadRetry } from '../engine/part';
import { contentKey } from '../engine/evalMemo';
import type { StudioDoc } from '../engine/doc';
import { BASE, type FaceTable, type Vec3 } from './mates';
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
/** The face table of a part's outputs (their B-reps). */
export function faceTableFrom(outputs: readonly { readonly brep: { readonly faces: readonly Brep['faces'][number][] } }[]): FaceTable {
  // Every part's origin planes (in its own coordinates) mate like flat faces.
  const table: FaceTable = { ...ORIGIN_PLANES };
  for (const o of outputs) for (const f of o.brep.faces) {
    const name = (f.name ?? f.id).replace(/#\d+$/, '');
    if (table[name]) continue;
    try {
      const g = faceGeometry(f);
      if (g.kind === 'plane') table[name] = { kind: 'plane', point: snap(g.o), normal: snapUnit(g.n) };
      else if (g.kind === 'cylinder') table[name] = { kind: 'cylinder', point: snap(g.c), axis: snapUnit(g.a), radius: clean(g.r), outer: g.out > 0 };
    } catch { /* a general surface: not mateable */ }
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

