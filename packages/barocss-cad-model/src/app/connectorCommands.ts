// Connector openings (R12c.7, D162): one flat face picked and one of the user's connector rows (none built in) — the
// opening cut there, the row's mating body seated in it, and the row's keep-out in front of it written to the part's
// keep-outs (A6.3), where the part's bodies are checked against it.
import { connectorFrame, connectorKeepOut } from '@barocss/cad';
import { withNode } from '../engine/doc';
import type { Keepout, ReferenceSet } from '../chat/references';
import type { Command, Ctx } from './commands';

const ok = { ok: true as const };
const no = (reason: string) => ({ ok: false as const, reason });
/** The one picked flat face: its body's ref, name, outward normal and centroid. */
function pickedFlat(ctx: Ctx) {
  if (ctx.selection.faces.length !== 1) return null;
  const f = ctx.selection.faces[0], body = ctx.bodies[f.body], face = body?.mesh.faces[f.face];
  if (!body?.ref || face?.exact?.kind !== 'plane') return null;
  return { ref: body.ref, name: face.name, normal: face.normal as [number, number, number], centroid: face.centroid as [number, number, number] };
}
const connectorCommand: Command = {
  id: 'connector', label: 'Connector opening', icon: 'cad-connector', group: 'modify', keywords: 'connector port receptacle',
  hint: 'An opening for one of your connector rows (none built in) cut into the picked flat face, the row\'s mating body seated in it — its gaps and how far it stands out in its notes, an overlap refused — and the row\'s keep-out in front of it added to the part\'s keep-outs. Envelopes only',
  available: ctx => !ctx.doc.connectors?.rows.length ? no('Load your connector rows first (Library panel, CONNECTORS): none is built in.') : pickedFlat(ctx) ? ok : no('Pick one flat face for the opening.'),
  fields: ctx => [{ key: 'row', label: 'Connector row', kind: 'choice', options: (ctx.doc.connectors?.rows ?? []).map(r => ({ value: r.id, label: `${r.name ?? r.id}${r.estimate ? ' (estimate)' : ''}` })) },
    { key: 'u', label: 'Off the face\'s centre along its width', kind: 'mm' }, { key: 'v', label: 'Off the face\'s centre across it', kind: 'mm' }, { key: 'rot', label: 'Rotation', kind: 'deg' }],
  defaults: ctx => ({ row: ctx.doc.connectors?.rows[0]?.id ?? '', u: 0, v: 0, rot: 0 }),
  build: (ctx, v) => {
    const p = pickedFlat(ctx)!, row = ctx.doc.connectors!.rows.find(r => r.id === v.row)!, rot = Number(v.rot) || 0, f0 = connectorFrame(p.centroid, p.normal, rot);
    const u = Number(v.u) || 0, w = Number(v.v) || 0, center: [number, number, number] = [0, 1, 2].map(k => p.centroid[k] + u * f0.x[k] + w * f0.y[k]) as [number, number, number];
    let doc = withNode(ctx.doc, { kind: 'connector-opening', parent: { node: p.ref.node, side: p.ref.side }, face: p.name, row: row.id, center, ...(rot ? { rotation: rot } : {}) });
    const opening = doc.nodes.length - 1;
    if (row.body) doc = withNode(doc, { kind: 'connector-body', opening });
    const ko = connectorKeepOut(row, center, p.normal, rot);
    if (ko) {
      // (In A6.3's keep-outs: the part's bodies checked against the plug's space; placed with the opening, kept if it moves.)
      const refs: ReferenceSet = doc.references ?? { version: 1, references: [], datums: [], keepouts: [] }, k: Keepout = { id: `connector-n${opening}`, name: `${row.name ?? row.id}: the plug's space`, frame: { origin: ko.frame.origin, normal: ko.frame.normal, xAxis: ko.frame.xAxis }, shape: { kind: 'box', size: [ko.size[0], ko.size[1], ko.size[2]] }, clearance: 0 };
      doc = { ...doc, references: { ...refs, keepouts: [...refs.keepouts.filter(x => x.id !== k.id), k] } };
    }
    return doc;
  },
};
export const connectorCommands: Command[] = [connectorCommand];
