import { isNumberValue, type ParsedClassToken } from "../../parser/utils";

/**
 * Scroll margin utilities for Tailwind CSS v4.1
 * Handles scroll-m, scroll-mx, scroll-my, scroll-mt, scroll-mr, scroll-mb, scroll-ml, scroll-ms, scroll-me
 * Supports spacing scale, negative, custom property, arbitrary, and !important
 * https://tailwindcss.com/docs/scroll-margin
 */

// Helper to compute scroll-margin value
function getScrollMarginValue(utility: ParsedClassToken): string {
  const negative = utility.negative ? '-' : '';
  if (utility.customProperty && utility.value) {
    return `var(${utility.value})`;
  }
  if (utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  if (utility.value && utility.slash) {
    // fraction not standard for scroll-margin, fallback to arbitrary
    return `calc(${utility.value} / ${utility.slash})`;
  }
  if (utility.value && isNumberValue(utility.value)) {
    return `calc(var(--spacing)*${negative}${utility.value})`;
  }
  if (utility.value) {
    return negative + utility.value;
  }
  return '';
}

/** scroll-m: all sides */
export const scrollM = (utility: ParsedClassToken) => ({
  scrollMargin: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-mx: inline (left/right) */
export const scrollMx = (utility: ParsedClassToken) => {
  const v = getScrollMarginValue(utility) + (utility.important ? ' !important' : '');
  return {
    scrollMarginLeft: v,
    scrollMarginRight: v,
    scrollMarginInline: v,
  };
};

/** scroll-my: block (top/bottom) */
export const scrollMy = (utility: ParsedClassToken) => {
  const v = getScrollMarginValue(utility) + (utility.important ? ' !important' : '');
  return {
    scrollMarginTop: v,
    scrollMarginBottom: v,
    scrollMarginBlock: v,
  };
};

/** scroll-mt: top */
export const scrollMt = (utility: ParsedClassToken) => ({
  scrollMarginTop: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-mr: right */
export const scrollMr = (utility: ParsedClassToken) => ({
  scrollMarginRight: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-mb: bottom */
export const scrollMb = (utility: ParsedClassToken) => ({
  scrollMarginBottom: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-ml: left */
export const scrollMl = (utility: ParsedClassToken) => ({
  scrollMarginLeft: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-ms: logical inline-start */
export const scrollMs = (utility: ParsedClassToken) => ({
  scrollMarginInlineStart: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-me: logical inline-end */
export const scrollMe = (utility: ParsedClassToken) => ({
  scrollMarginInlineEnd: getScrollMarginValue(utility) + (utility.important ? ' !important' : '')
});

/**
 * Scroll padding utilities for Tailwind CSS v4.1
 * Handles scroll-p, scroll-px, scroll-py, scroll-pt, scroll-pr, scroll-pb, scroll-pl, scroll-ps, scroll-pe
 * Supports spacing scale, negative, custom property, arbitrary, and !important
 * https://tailwindcss.com/docs/scroll-padding
 */

function getScrollPaddingValue(utility: ParsedClassToken): string {
  const negative = utility.negative ? '-' : '';
  if (utility.customProperty && utility.value) {
    return `var(${utility.value})`;
  }
  if (utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  if (utility.value && utility.slash) {
    // fraction not standard for scroll-padding, fallback to arbitrary
    return `calc(${utility.value} / ${utility.slash})`;
  }
  if (utility.value && isNumberValue(utility.value)) {
    return `calc(var(--spacing)*${negative}${utility.value})`;
  }
  if (utility.value) {
    return negative + utility.value;
  }
  return '';
}

/** scroll-p: all sides */
export const scrollP = (utility: ParsedClassToken) => ({
  scrollPadding: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-px: inline (left/right) */
export const scrollPx = (utility: ParsedClassToken) => {
  const v = getScrollPaddingValue(utility) + (utility.important ? ' !important' : '');
  return {
    scrollPaddingLeft: v,
    scrollPaddingRight: v,
    scrollPaddingInline: v,
  };
};

/** scroll-py: block (top/bottom) */
export const scrollPy = (utility: ParsedClassToken) => {
  const v = getScrollPaddingValue(utility) + (utility.important ? ' !important' : '');
  return {
    scrollPaddingTop: v,
    scrollPaddingBottom: v,
    scrollPaddingBlock: v,
  };
};

/** scroll-pt: top */
export const scrollPt = (utility: ParsedClassToken) => ({
  scrollPaddingTop: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-pr: right */
export const scrollPr = (utility: ParsedClassToken) => ({
  scrollPaddingRight: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-pb: bottom */
export const scrollPb = (utility: ParsedClassToken) => ({
  scrollPaddingBottom: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-pl: left */
export const scrollPl = (utility: ParsedClassToken) => ({
  scrollPaddingLeft: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-ps: logical inline-start */
export const scrollPs = (utility: ParsedClassToken) => ({
  scrollPaddingInlineStart: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/** scroll-pe: logical inline-end */
export const scrollPe = (utility: ParsedClassToken) => ({
  scrollPaddingInlineEnd: getScrollPaddingValue(utility) + (utility.important ? ' !important' : '')
});

/**
 * Scroll snap align utilities for Tailwind CSS v4.1
 * https://tailwindcss.com/docs/scroll-snap-align
 */

const snapMap: Record<string, string> = {
  'start': 'start',
  'end': 'end',
  'center': 'center',
  'align-none': 'none',
};

const snapStopMap: Record<string, string> = {
  'normal': 'normal',
  'always': 'always',
};

const snapTypeMap: Record<string, string> = {
  'none': 'none',
  'x': 'x',
  'y': 'y',
  'both': 'both',
};

const snapStrictnessMap: Record<string, string> = {
  'mandatory': 'mandatory',
  'proximity': 'proximity',
};

/**
 * snap utility: handles scroll-snap-align, scroll-snap-stop, scroll-snap-type
 * - snap-start, snap-end, snap-center, snap-align-none → scrollSnapAlign
 * - snap-normal, snap-always → scrollSnapStop
 * - snap-none, snap-x, snap-y, snap-both → scrollSnapType
 * - snap-mandatory, snap-proximity → --tw-scroll-snap-strictness
 * - !important supported
 * https://tailwindcss.com/docs/scroll-snap-align
 * https://tailwindcss.com/docs/scroll-snap-stop
 * https://tailwindcss.com/docs/scroll-snap-type
 */
export const snap = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  // scroll-snap-stop
  if (utility.value && snapStopMap[utility.value]) {
    return { scrollSnapStop: snapStopMap[utility.value] + important };
  }
  // scroll-snap-type
  if (utility.value && snapTypeMap[utility.value]) {
    if (utility.value === 'none') {
      return { scrollSnapType: 'none' + important };
    }
    // snap-x, snap-y, snap-both
    return { scrollSnapType: `${snapTypeMap[utility.value]} var(--tw-scroll-snap-strictness)` + important };
  }
  // snap-mandatory, snap-proximity (set CSS variable)
  if (utility.value && snapStrictnessMap[utility.value]) {
    return { '--tw-scroll-snap-strictness': snapStrictnessMap[utility.value] + important };
  }
  // scroll-snap-align
  return { scrollSnapAlign: snapMap[utility.value] + important };
};

/**
 * scroll-behavior utility for Tailwind CSS v4.1
 * https://tailwindcss.com/docs/scroll-behavior
 */

const scrollBehaviorMap: Record<string, string> = {
  'auto': 'auto',
  'smooth': 'smooth',
  'instant': 'instant',
};

export const scroll = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  if (utility.value && scrollBehaviorMap[utility.value]) {
    return { scrollBehavior: scrollBehaviorMap[utility.value] + important };
  }
  return { scrollBehavior: 'auto' + important };
};