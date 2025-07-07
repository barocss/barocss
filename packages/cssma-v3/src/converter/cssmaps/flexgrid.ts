import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// flex/grid (flex, grid, gap, items, justify 등)
// "flex-row" → { prefix: "flex", value: "row" } → { flexDirection: "row" }
// "grid-cols-3" → { prefix: "grid-cols", value: "3" } → { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
export const flex = (utility: ParsedClassToken) => ({ flexDirection: utility.value + (utility.important ? ' !important' : '') });
export const gridCols = (utility: ParsedClassToken) => ({ gridTemplateColumns: `repeat(${utility.value}, minmax(0, 1fr))` + (utility.important ? ' !important' : '') });
export const gap = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const gap = ctx.theme?.('spacing', utility.value) ?? utility.value;
  return { gap: gap + (utility.important ? ' !important' : '') };
};
export const items = (utility: ParsedClassToken) => ({ alignItems: utility.value + (utility.important ? ' !important' : '') });
export const justify = (utility: ParsedClassToken) => ({ justifyContent: utility.value + (utility.important ? ' !important' : '') }); 