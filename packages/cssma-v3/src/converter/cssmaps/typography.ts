import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// typography (font, leading, tracking, line-clamp 등)
// "font-bold" → { prefix: "font", value: "bold" } → { fontWeight: "700" }
// "font-[900]" → { prefix: "font", arbitrary: true, arbitraryValue: "900" } → { fontWeight: "900" }
export const font = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.arbitrary) return { fontWeight: utility.arbitraryValue + (utility.important ? ' !important' : '') };
  const weight = ctx.theme?.('fontWeight', utility.value);
  if (weight) return { fontWeight: weight + (utility.important ? ' !important' : '') };
  return {};
};
export const leading = (utility: ParsedClassToken, ctx: CssmaContext) => ({ lineHeight: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('lineHeight', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const tracking = (utility: ParsedClassToken, ctx: CssmaContext) => ({ letterSpacing: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('letterSpacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const lineClamp = (utility: ParsedClassToken) => ({ WebkitLineClamp: utility.value + (utility.important ? ' !important' : '') }); 