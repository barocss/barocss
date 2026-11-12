import type { Command, Ctx } from '@barocss/cad-model/app/commands';

export function footprintBody(ctx: Ctx) {
  const { bodies, faces, edges, vertices, sketches } = ctx.selection;
  if (bodies.length !== 1 || faces.length || edges.length || vertices?.length || sketches?.length
    || ctx.direct?.length || ctx.doc.instances?.length) return null;
  const body = ctx.bodies[bodies[0]];
  const output = body && ctx.doc.outputs[body.key];
  return body?.ref && output && output.node === body.ref.node && output.side === body.ref.side ? body.key : null;
}

export const PROJECT_TO_SKETCH: Command = {
  id: 'project-to-sketch', label: 'Project to sketch', icon: 'cad-sketch', group: 'create',
  hint: 'Copy the selected solid’s XY material footprint into an editable sketch',
  keywords: 'projection footprint silhouette body sketch',
  available: ctx => footprintBody(ctx) ? { ok: true } : { ok: false, reason: 'Select one solid in its own part.' },
};
