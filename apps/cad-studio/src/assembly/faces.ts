// A part's faces as mates read them: each persistent face name with its exact plane or cylinder, in the
// part's own coordinates, from the kernel's B-rep (not the display mesh, which is single precision).
import { evaluateCadPart, faceGeometry } from '@barocss/cad';
import { toPartDocument } from '../engine/part';
import type { StudioDoc } from '../engine/doc';
import { clean, type FaceTable, type Vec3 } from './mates';

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

/** The flat and cylindrical faces of a part by name (pieces of one face, `x#1` and `x#2`, read as `x`). */
export function faceTableOf(doc: StudioDoc): FaceTable {
  // Every part's origin planes (in its own coordinates) mate like flat faces.
  const table: FaceTable = { ...ORIGIN_PLANES };
  if (!doc.nodes.length) return table;
  let outputs;
  try { outputs = evaluateCadPart(toPartDocument(doc)).outputs; } catch { return table; }
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
export const faceKey = (doc: StudioDoc) => JSON.stringify([doc.nodes, doc.parameters]);
