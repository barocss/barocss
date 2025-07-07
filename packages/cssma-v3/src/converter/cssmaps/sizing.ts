import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// sizing (width, height, min/max)
// "w-1/2" → { prefix: "w", value: "1/2" } → { width: "50%" }
// "w-[300px]" → { prefix: "w", arbitrary: true, arbitraryValue: "300px" } → { width: "300px" }
export const w = (utility: ParsedClassToken, ctx: CssmaContext) => ({ width: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('width', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const h = (utility: ParsedClassToken, ctx: CssmaContext) => ({ height: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('height', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const minW = (utility: ParsedClassToken, ctx: CssmaContext) => ({ minWidth: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('minWidth', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const maxW = (utility: ParsedClassToken, ctx: CssmaContext) => ({ maxWidth: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('maxWidth', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const minH = (utility: ParsedClassToken, ctx: CssmaContext) => ({ minHeight: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('minHeight', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const maxH = (utility: ParsedClassToken, ctx: CssmaContext) => ({ maxHeight: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('maxHeight', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') }); 