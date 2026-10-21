// The command palette's list for a query: the commands whose label, keywords or id hold it, those available here
// first (the palette's own order, kept out of the component so it can be tested: D157's fix).
import { commands as all, type Command, type Ctx } from '@barocss/cad-model/app/commands';

export function paletteList(q: string, ctx: Ctx, commands: readonly Command[] = all): { c: Command; a: ReturnType<Command['available']> }[] {
  const s = q.trim().toLowerCase();
  return commands.map(c => ({ c, a: c.available(ctx) }))
    .filter(({ c }) => !s || (c.label + ' ' + (c.keywords ?? '') + ' ' + c.id).toLowerCase().includes(s))
    .sort((x, y) => Number(y.a.ok) - Number(x.a.ok));
}
