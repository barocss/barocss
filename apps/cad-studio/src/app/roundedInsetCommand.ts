import type { Command } from '@barocss/cad-model/app/commands';
import { createRoundedInsetExtrusion } from '@barocss/cad-model/sketch/internal/roundedInsetRecipe';

export const LINKED_INSET_EXTRUDE: Command = {
  id: 'linked-inset-extrude', label: 'Linked inset extrude', icon: 'cad-extrude', group: 'create',
  available: ({ doc, selection, bodies, direct }) => {
    const { sketches, faces, edges, vertices, bodies: pickedBodies } = selection;
    if (doc.nodes.length === 1 && doc.nodes[0].kind === 'sketch' && doc.nodes[0].profile === 'loop'
      && sketches?.length === 1 && sketches[0] === 0 && !bodies.length
      && !faces.length && !edges.length && !vertices?.length && !pickedBodies.length && !direct?.length) return { ok: true };
    return { ok: false, reason: 'Select one finished rounded rectangle sketch in a standalone part.' };
  },
  defaults: () => ({ inset: 1, height: 10 }),
  fields: () => [
    { kind: 'mm', key: 'inset', label: 'Inset distance', min: 0 },
    { kind: 'mm', key: 'height', label: 'Extrude distance', min: 0 },
  ],
  build: ({ doc }, values) => createRoundedInsetExtrusion(doc, Number(values.inset), Number(values.height)),
};
