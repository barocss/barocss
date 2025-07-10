import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// sizing (width, height, min/max)
// Tailwind width, min/max-width, height, min/max-height 완전 대응
// "w-1/2" → { width: "50%" }
// "w-[300px]" → { width: "300px" }
// "w-(--my-width)" → { width: var(--my-width) }
// "w-full" → { width: "100%" }
// "w-auto" → { width: "auto" }
// "w-px" → { width: "1px" }
// "w-screen" → { width: "100vw" }
// "w-min" → { width: "min-content" }
// "w-max" → { width: "max-content" }
// "w-fit" → { width: "fit-content" }
// "w-1/3" → { width: "33.333333%" }
// "w-xs" → { width: var(--container-xs) }
// "w-[var(--foo)]" → { width: "var(--foo)" }

function getSizingValue(utility: ParsedClassToken, ctx: CssmaContext, type: 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') {
  // custom property (e.g. w-(--my-width))
  if (utility.customProperty && utility.value) return `var(${utility.value})`;
  // arbitrary value (e.g. w-[300px])
  if (utility.arbitrary && utility.arbitraryValue) return utility.arbitraryValue;
  // fraction (e.g. w-1/2)
  if (utility.value && utility.slash) {
    const result = Number(utility.value) / Number(utility.slash);
    return `${result * 100}%`;
  }
  // special keywords
  if (utility.value) {
    switch (utility.value) {
      case 'full': return '100%';
      case 'screen': return type === 'width' ? '100vw' : '100vh';
      case 'dvw': return '100dvw';
      case 'dvh': return '100dvh';
      case 'lvw': return '100lvw';
      case 'lvh': return '100lvh';
      case 'svw': return '100svw';
      case 'svh': return '100svh';
      case 'auto': return 'auto';
      case 'px': return '1px';
      case 'min': return 'min-content';
      case 'max': return 'max-content';
      case 'fit': return 'fit-content';
      default: break;
    }
  }
  // container scale (e.g. w-xs, w-2xl)
  if (type === 'width' && utility.value && /^(3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/.test(utility.value)) {
    return `var(--container-${utility.value})`;
  }
  // theme value
  const themeVal = ctx.theme?.(type, utility.value);
  if (themeVal !== undefined) return themeVal;
  // fallback (raw value)
  if (utility.value) return utility.value;
  return undefined;
}

function getSizeValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (e.g. size-(--my-size))
  if (utility.customProperty && utility.value) return { w: `var(${utility.value})`, h: `var(${utility.value})` };
  // arbitrary value (e.g. size-[300px])
  if (utility.arbitrary && utility.arbitraryValue) return { w: utility.arbitraryValue, h: utility.arbitraryValue };
  // fraction (e.g. size-1/2)
  if (utility.value && utility.slash) {
    const result = Number(utility.value) / Number(utility.slash);
    return { w: `${result * 100}%`, h: `${result * 100}%` };
  }
  // special keywords
  if (utility.value) {
    switch (utility.value) {
      case 'full': return { w: '100%', h: '100%' };
      case 'screen': return { w: '100vw', h: '100vh' };
      case 'dvw': return { w: '100dvw', h: '100dvw' };
      case 'dvh': return { w: '100dvh', h: '100dvh' };
      case 'lvw': return { w: '100lvw', h: '100lvw' };
      case 'lvh': return { w: '100lvh', h: '100lvh' };
      case 'svw': return { w: '100svw', h: '100svw' };
      case 'svh': return { w: '100svh', h: '100svh' };
      case 'auto': return { w: 'auto', h: 'auto' };
      case 'px': return { w: '1px', h: '1px' };
      case 'min': return { w: 'min-content', h: 'min-content' };
      case 'max': return { w: 'max-content', h: 'max-content' };
      case 'fit': return { w: 'fit-content', h: 'fit-content' };
      default: break;
    }
  }
  // theme value (spacing scale)
  const spacing = ctx.theme?.('spacing', utility.value);
  if (spacing !== undefined) return { w: spacing, h: spacing };
  // fallback (raw value)
  if (utility.value) return { w: utility.value, h: utility.value };
  return undefined;
}

export const w = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'width');
  if (val === undefined) return {};
  return { width: val + (utility.important ? ' !important' : '') };
};
export const minW = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'minWidth');
  if (val === undefined) return {};
  return { minWidth: val + (utility.important ? ' !important' : '') };
};
export const maxW = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'maxWidth');
  if (val === undefined) return {};
  return { maxWidth: val + (utility.important ? ' !important' : '') };
};
export const h = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'height');
  if (val === undefined) return {};
  return { height: val + (utility.important ? ' !important' : '') };
};
export const minH = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'minHeight');
  if (val === undefined) return {};
  return { minHeight: val + (utility.important ? ' !important' : '') };
};
export const maxH = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizingValue(utility, ctx, 'maxHeight');
  if (val === undefined) return {};
  return { maxHeight: val + (utility.important ? ' !important' : '') };
};
export const size = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getSizeValue(utility, ctx);
  if (!val) return {};
  const imp = utility.important ? ' !important' : '';
  return { width: val.w + imp, height: val.h + imp };
}; 