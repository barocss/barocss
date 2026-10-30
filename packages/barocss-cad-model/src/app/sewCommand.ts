import type { Command } from './commands';
import { withNode } from '../engine/doc';
import { sewNode, sewSnapshot } from '../engine/sew';

export const sewCommand: Command = {
  id: 'sew', label: 'Sew', icon: 'cad-shell', group: 'create', keywords: 'surfaces join solid snapshot',
  hint: 'Copy whole surfaces into an independent body; later source edits do not update it',
  available(ctx) {
    try { sewSnapshot(ctx); return { ok: true }; }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error) }; }
  },
  fields: () => [{ key: 'tol', label: 'Tolerance (0: automatic)', kind: 'mm', min: 0, max: 1 }],
  defaults: () => ({ tol: 0 }),
  steps: ctx => [{ label: 'Copied sources', text: sewSnapshot(ctx).names.join(', '), done: true }],
  build(ctx, values) {
    const next = withNode(ctx.doc, sewNode(sewSnapshot(ctx), values.tol as number));
    if (ctx.sewSnapshot || !ctx.doc.direct) return next;
    const ids = new Set(ctx.direct);
    return { ...next, direct: { ...ctx.doc.direct, objects: ctx.doc.direct.objects.map(o => ids.has(o.id) ? { ...o, hidden: true } : o) } };
  },
};
