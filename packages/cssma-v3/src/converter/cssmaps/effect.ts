import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// effect (shadow, opacity 등)
// "shadow-lg" → { prefix: "shadow", value: "lg" } → { boxShadow: "..." }
// "opacity-50" → { prefix: "opacity", value: "50" } → { opacity: "0.5" }
export const shadow = (utility: ParsedClassToken, ctx: CssmaContext) => ({ boxShadow: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('boxShadow', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const opacity = (utility: ParsedClassToken, ctx: CssmaContext) => ({ opacity: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('opacity', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') }); 