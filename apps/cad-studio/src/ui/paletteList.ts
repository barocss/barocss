// The command palette's list for a query (kept out of the component so it can be tested: D157's fix), ranked by
// ui/paletteRank.ts (O134): a command's own label before any keyword or id match, those available here first only
// within a rank.
import { commands as all, type Command, type Ctx } from '@barocss/cad-model/app/commands';
import { paletteOrder } from './paletteRank';

export function paletteList(q: string, ctx: Ctx, commands: readonly Command[] = all): { c: Command; a: ReturnType<Command['available']> }[] {
  const av = new Map(commands.map(c => [c, c.available(ctx)]));
  return paletteOrder(commands.map(c => ({ c, ok: av.get(c)!.ok })), q).map(({ c }) => ({ c, a: av.get(c)! }));
}
