import type { Ctx } from '@barocss/cad-model/app/commands';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';

/** Hide copied sources only while their Sew candidate is drawn. Accepted display data stays intact. */
export function sewPreviewDirect(items: DirectDisplay[], commandId: string | undefined, ctx: Pick<Ctx, 'direct' | 'sewSnapshot'> | undefined, candidateShown: boolean): DirectDisplay[] {
  if (commandId !== 'sew' || !candidateShown || ctx?.sewSnapshot || !ctx?.direct?.length) return items;
  const consumed = new Set(ctx.direct), shown: DirectDisplay[] = [];
  for (const item of items) {
    if (!consumed.has(item.id)) shown.push(item);
  }
  return shown.length === items.length ? items : shown;
}
