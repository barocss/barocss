import { commands, type Ctx } from '@barocss/cad-model/app/commands';

const sketch = commands.find(command => command.id === 'sketch')!;
const extrude = commands.find(command => command.id === 'extrude')!;
const hole = commands.find(command => command.id === 'hole')!;
const fillet = commands.find(command => command.id === 'fillet')!;

export const primaryModelCommands = [sketch, extrude] as const;

/** Reuse command availability after checking that the current selection owns the picked entities. */
export function contextualModelCommand(ctx: Ctx, current: boolean) {
  const { faces, edges, bodies, vertices, sketches } = ctx.selection;
  if (!current || ctx.direct?.length || bodies.length || vertices?.length || sketches?.length) return;
  if (!edges.length && faces.length === 1) {
    const face = faces[0];
    const body = ctx.bodies[face.body];
    if (body && !body.cylindricalWrap && body.mesh.faces[face.face] && hole.available(ctx).ok) return hole;
  }
  if (!faces.length && edges.length) {
    const body = ctx.bodies[edges[0].body];
    if (body && body.family !== 'faceted' && !body.band && !body.cylindricalWrap && body.role !== 'infill'
      && edges.every(edge => edge.body === edges[0].body && body.mesh.edges[edge.edge])
      && fillet.available(ctx).ok) return fillet;
  }
}
