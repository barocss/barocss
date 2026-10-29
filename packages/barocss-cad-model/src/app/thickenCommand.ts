import type { Command } from './commands';
import { withNode } from '../engine/doc';
import { thickenNode, thickenSnapshot } from '../engine/thicken';

export const thickenCommand: Command = {
  id: 'thicken', label: 'Thicken', icon: 'cad-shell', group: 'create', keywords: 'surface wall solid snapshot',
  hint: 'Copy a whole surface into an independent body; later source edits do not update it',
  available(ctx) {
    try { thickenSnapshot(ctx); return { ok: true }; }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error) }; }
  },
  fields: () => [
    { key: 't', label: 'Thickness', kind: 'mm', min: 0, max: 10000 },
    { key: 'side', label: 'Side', kind: 'choice', options: [{ value: 'normal', label: 'Normal' }, { value: 'reverse', label: 'Reverse' }, { value: 'both', label: 'Both' }] },
  ],
  defaults: () => ({ t: 2, side: 'normal' }),
  steps: ctx => [{ label: 'Copied source', text: thickenSnapshot(ctx).name, done: true }],
  build: (ctx, values) => withNode(ctx.doc, thickenNode(thickenSnapshot(ctx), Number(values.t), String(values.side ?? 'normal'))),
};
