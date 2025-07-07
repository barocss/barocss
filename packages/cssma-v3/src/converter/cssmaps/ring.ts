import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

export const ring = (utility: ParsedClassToken, ctx: CssmaContext) => {
  // ring-width, ring-color, ring-inset 등 value에 따라 분기
  if (utility.value === "inset") return { boxShadow: `inset 0 0 0 1px ${ctx.theme?.('ringColor', 'DEFAULT') ?? 'currentColor'}` };
  if (/^\d+$/.test(utility.value)) return { boxShadow: `0 0 0 ${utility.value}px ${ctx.theme?.('ringColor', 'DEFAULT') ?? 'currentColor'}` };
  // color
  const color = ctx.theme?.('ringColor', utility.value);
  if (color) return { boxShadow: `0 0 0 1px ${color}` };
  return {};
}; 