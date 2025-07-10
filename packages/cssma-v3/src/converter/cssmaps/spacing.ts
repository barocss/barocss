// spacing (margin, padding, space, gap 등)
// TailwindCSS margin/padding 완전 대응
// "m-4" → { margin: theme.spacing[4] }
// "-mx-2" → { marginLeft: -theme.spacing[2], marginRight: -theme.spacing[2] }
// "p-[10px]" → { padding: 10px }
// "m-(--my-margin)" → { margin: var(--my-margin) }
// "ps-2" → { paddingInlineStart: theme.spacing[2] }
// "ms-2" → { marginInlineStart: theme.spacing[2] }
// "p-2!" → { padding: ... !important }
import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// margin helpers
function getSpacingValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (e.g. m-(--my-margin))
  if (utility.customProperty) return `var(${utility.value})` + (utility.important ? ' !important' : '');
  // arbitrary value (e.g. m-[10px])
  if (utility.arbitrary) return utility.arbitraryValue + (utility.important ? ' !important' : '');
  // theme value (e.g. m-4)
  const themeVal = ctx.theme?.('spacing', utility.value);
  if (themeVal !== undefined) return themeVal + (utility.important ? ' !important' : '');
  // fallback (e.g. m-1.5)
  return utility.value + (utility.important ? ' !important' : '');
}

// margin
export const m = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSpacingValue(utility, ctx);
  return { margin: (utility.negative ? '-' : '') + val };
};
export const mx = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSpacingValue(utility, ctx);
  return {
    marginLeft: (utility.negative ? '-' : '') + val,
    marginRight: (utility.negative ? '-' : '') + val,
  };
};
export const my = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSpacingValue(utility, ctx);
  return {
    marginTop: (utility.negative ? '-' : '') + val,
    marginBottom: (utility.negative ? '-' : '') + val,
  };
};
export const mt = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginTop: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });
export const mb = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginBottom: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });
export const ml = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginLeft: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });
export const mr = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginRight: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });
// Logical margin (inline start/end)
export const ms = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginInlineStart: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });
export const me = (utility: ParsedClassToken, ctx: CssmaContext) => ({ marginInlineEnd: (utility.negative ? '-' : '') + getSpacingValue(utility, ctx) });

// padding helpers (no negative)
function getPaddingValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (e.g. p-(--my-padding))
  if (utility.customProperty) return `var(${utility.value})` + (utility.important ? ' !important' : '');
  // arbitrary value (e.g. p-[10px])
  if (utility.arbitrary) return utility.arbitraryValue + (utility.important ? ' !important' : '');
  // theme value (e.g. p-4)
  const themeVal = ctx.theme?.('spacing', utility.value);
  if (themeVal !== undefined) return themeVal + (utility.important ? ' !important' : '');
  // fallback (e.g. p-1.5)
  return utility.value + (utility.important ? ' !important' : '');
}
export const p = (utility: ParsedClassToken, ctx: CssmaContext) => ({ padding: getPaddingValue(utility, ctx) });
export const px = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  paddingLeft: getPaddingValue(utility, ctx),
  paddingRight: getPaddingValue(utility, ctx),
});
export const py = (utility: ParsedClassToken, ctx: CssmaContext) => ({
  paddingTop: getPaddingValue(utility, ctx),
  paddingBottom: getPaddingValue(utility, ctx),
});
export const pt = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingTop: getPaddingValue(utility, ctx) });
export const pb = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingBottom: getPaddingValue(utility, ctx) });
export const pl = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingLeft: getPaddingValue(utility, ctx) });
export const pr = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingRight: getPaddingValue(utility, ctx) });
// Logical padding (inline start/end)
export const ps = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingInlineStart: getPaddingValue(utility, ctx) });
export const pe = (utility: ParsedClassToken, ctx: CssmaContext) => ({ paddingInlineEnd: getPaddingValue(utility, ctx) }); 