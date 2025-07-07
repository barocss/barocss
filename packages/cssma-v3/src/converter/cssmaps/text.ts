import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// text (color, align, size 등)
// "text-center" → { prefix: "text", value: "center" } → { textAlign: "center" }
// "text-xs" → { prefix: "text", value: "xs" } → { fontSize: "0.75rem" }
// "text-[#ff0]" → { prefix: "text", arbitrary: true, arbitraryValue: "#ff0" } → { color: "#ff0" }
export const text = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if ([
    'left', 'center', 'right', 'justify', 'start', 'end'
  ].includes(utility.value))
    return { textAlign: utility.value + (utility.important ? ' !important' : '') };
  if (utility.arbitrary)
    return { color: utility.arbitraryValue + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color) return { color: color + (utility.important ? ' !important' : '') };
  const size = ctx.theme?.('fontSize', utility.value);
  if (size) return { fontSize: size + (utility.important ? ' !important' : '') };
  return {};
}; 