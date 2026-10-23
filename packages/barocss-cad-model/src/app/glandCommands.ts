// O-ring glands (R12c.5, D159): one face picked — a shaft's outside (piston), a bore (rod) or a flat face — and the user's
// O-ring row; the groove and the ring as two nodes. The prefilled groove sizes come from target squeeze and fill taken in
// O2's ranges (estimates, said so in the labels); the user's own sizes take their place.
import { withNode } from '../engine/doc';
import type { Command, Ctx, Values } from './commands';
import { r3Signed as r3 } from '../util/round';

const ok = { ok: true as const };
const no = (reason: string) => ({ ok: false as const, reason });
/** The one picked face: its body's ref, name, the kind of gland it takes, its Ø and its extent along its axis. */
function pickedFace(ctx: Ctx) {
  if (ctx.selection.faces.length !== 1) return null;
  const f = ctx.selection.faces[0], body = ctx.bodies[f.body], face = body?.mesh.faces[f.face];
  if (!body?.ref || !face?.exact) return null;
  const e = face.exact;
  if (e.kind === 'plane') return { ref: body.ref, name: face.name, kind: 'face' as const, diameter: 0, length: 0, centroid: face.centroid };
  // (Its extent: its mesh vertices projected on the axis. Bore or shaft by one vertex's normal against its radial
  // direction: a whole cylinder's centroid lies on its axis, so the centroid's radial direction is none.)
  const m = body.mesh, at: number[] = [];
  let bore: boolean | null = null;
  for (let v = 0; v < m.faceOfVertex.length; v++) {
    if (m.faceOfVertex[v] !== f.face) continue;
    const d = [m.positions[3 * v] - e.c[0], m.positions[3 * v + 1] - e.c[1], m.positions[3 * v + 2] - e.c[2]], along = d[0] * e.a[0] + d[1] * e.a[1] + d[2] * e.a[2];
    at.push(along);
    if (bore === null) { const radial = [d[0] - e.a[0] * along, d[1] - e.a[1] * along, d[2] - e.a[2] * along]; bore = radial[0] * m.normals[3 * v] + radial[1] * m.normals[3 * v + 1] + radial[2] * m.normals[3 * v + 2] < 0; }
  }
  return { ref: body.ref, name: face.name, kind: bore === true ? 'rod' as const : 'piston' as const, diameter: 2 * e.r, length: at.length ? Math.max(...at) - Math.min(...at) : 0, centroid: face.centroid };
}

const glandCommand: Command = {
  id: 'oring-gland', label: 'O-ring gland', icon: 'cad-oring', group: 'modify', keywords: 'o-ring oring gland',
  hint: 'An O-ring gland cut into the picked face — a shaft\'s outside (piston), a bore (rod) or a flat face — for one of your O-ring rows (none built in), with the ring in it: its stretch, squeeze and fill checked against the guidance ranges (estimates unless yours). The squeezed ring\'s shape is not modelled',
  available: ctx => !ctx.doc.orings?.rows.length ? no('Load your O-ring rows first (Library panel, O-RINGS): none is built in.') : pickedFace(ctx) ? ok : no('Pick one face: a shaft\'s outside, a bore, or a flat face.'),
  fields: ctx => {
    const p = pickedFace(ctx), rows = ctx.doc.orings?.rows ?? [], radial = p?.kind !== 'face';
    return [{ key: 'ring', label: 'O-ring row', kind: 'choice', options: rows.map(r => ({ value: r.id, label: `${r.dash ?? r.id} · ID ${r.insideDiameterMM} × CS ${r.crossSectionMM}${r.estimate ? ' (estimate)' : ''}` })) },
      ...(radial ? [{ key: 'seal', label: p?.kind === 'rod' ? 'Rod Ø it seals on' : 'Bore Ø it seals on', kind: 'mm' as const, min: 0.1 }] : []),
      { key: 'dg', label: radial ? 'Groove bottom Ø (from 20 % squeeze, an estimate)' : 'Groove inner Ø (the ring\'s ID, an estimate)', kind: 'mm', min: 0.1 },
      { key: 'w', label: 'Groove width (from 80 % fill, an estimate)', kind: 'mm', min: 0.1 },
      ...(radial ? [{ key: 'at', label: 'Groove from the face\'s start', kind: 'mm' as const, min: 0 }] : [{ key: 'h', label: 'Groove depth (from 25 % squeeze, an estimate)', kind: 'mm' as const, min: 0.05 }])];
  },
  defaults: (ctx): Values => {
    const p = pickedFace(ctx), row = ctx.doc.orings?.rows[0], CS = row?.crossSectionMM ?? 3, ID = row?.insideDiameterMM ?? 20;
    if (!p || p.kind === 'face') { const h = 0.75 * CS; return { ring: row?.id ?? '', dg: r3(ID), w: r3(Math.PI * CS * CS / 4 / (0.8 * h)), h: r3(h) }; }
    const h = 0.8 * CS, seal = p.kind === 'piston' ? r3(p.diameter + 0.1) : r3(p.diameter - 0.1), dg = p.kind === 'piston' ? r3(seal - 2 * h) : r3(seal + 2 * h), w = r3(Math.PI * CS * CS / 4 / (0.8 * h));
    return { ring: row?.id ?? '', seal, dg, w, at: r3(Math.max(0, (p.length - w) / 2)) };
  },
  build: (ctx, v) => {
    const p = pickedFace(ctx)!, n = (k: string) => Number(v[k]);
    const gland = withNode(ctx.doc, { kind: 'oring-gland', parent: { node: p.ref.node, side: p.ref.side }, face: p.name, gland: p.kind, ring: String(v.ring), diameter: n('dg'), width: n('w'),
      ...(p.kind === 'face' ? { depth: n('h'), center: [p.centroid[0], p.centroid[1], p.centroid[2]] as [number, number, number] } : { at: n('at'), seal: n('seal') }) });
    return withNode(gland, { kind: 'oring', gland: gland.nodes.length - 1 });
  },
};

export const glandCommands: Command[] = [glandCommand];
