import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS gap-* 유틸리티 완전 대응
// gap-4, gap-x-2, gap-y-1.5, gap-[10px], gap-(--my-gap), gap-px, gap-0 등

function getGapValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (gap-(--my-gap))
  if (utility.customProperty && utility.value) {
    return `var(${utility.value})`;
  }
  // arbitrary value (gap-[10px])
  if (utility.arbitrary && utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  // theme spacing (gap-4, gap-1.5, gap-px, ...)
  if (utility.value) {
    const themeGap = ctx.theme?.("gap", utility.value) ?? ctx.theme?.("spacing", utility.value);
    if (themeGap) return themeGap;
    // px
    if (utility.value === "px") return "1px";
    // number or decimal (gap-0, gap-0.5, gap-1, ...)
    if (isNumberValue(utility.value)) {
      // fallback: try spacing scale
      const spacing = ctx.theme?.("spacing", utility.value);
      if (spacing) return spacing;
      // fallback: px for 0
      if (utility.value === "0") return "0px";
      return utility.value;
    }
  }
  return undefined;
}

export const gap = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const value = getGapValue(utility, ctx);
  if (value === undefined) return {};
  return {
    gap: value + (utility.important ? " !important" : "")
  };
};

export const gapX = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const value = getGapValue(utility, ctx);
  if (value === undefined) return {};
  return {
    columnGap: value + (utility.important ? " !important" : "")
  };
};

export const gapY = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const value = getGapValue(utility, ctx);
  if (value === undefined) return {};
  return {
    rowGap: value + (utility.important ? " !important" : "")
  };
}; 