import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// spacing (margin, padding, space, gap 등)
// "m-4" → { prefix: "m", value: "4", numeric: true } → { margin: "1rem" }
// "-mx-2" → { prefix: "mx", value: "2", negative: true, numeric: true } → { marginLeft: "-0.5rem", marginRight: "-0.5rem" }
// "p-[10px]" → { prefix: "p", arbitrary: true, arbitraryValue: "10px" } → { padding: "10px" }
export const m = (utility: ParsedClassToken, ctx: CssmaContext) => ({ margin: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const mx = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  marginLeft: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
  marginRight: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
});
export const my = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  marginTop: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
  marginBottom: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
});
export const mt = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginTop: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const mb = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginBottom: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const ml = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginLeft: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const mr = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginRight: (utility.negative ? '-' : '') + (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const p = (utility: ParsedClassToken, ctx: CssmaContext) => ({ padding: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const px = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  paddingLeft: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
  paddingRight: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
});
export const py = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  paddingTop: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
  paddingBottom: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : ''),
});
export const pt = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingTop: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const pb = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingBottom: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const pl = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingLeft: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });
export const pr = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingRight: (utility.arbitrary ? utility.arbitraryValue : ctx.theme?.('spacing', utility.value) ?? utility.value) + (utility.important ? ' !important' : '') });

// ... 나머지 my, mt, mb, ml, mr, p, px, py, pt, pb, pl, pr 등도 동일 패턴으로 export 