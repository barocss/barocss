import type { ParsedClassToken } from "../../parser/utils";

/**
 * Scroll utilities for Tailwind CSS v4
 * Handles scroll behavior, margins, padding, and snap properties
 */

// overscroll
export const overscroll = (utility: ParsedClassToken) => ({ 
  overscrollBehavior: utility.value + (utility.important ? ' !important' : '') 
});

// overscroll-x
export const overscrollX = (utility: ParsedClassToken) => ({ 
  overscrollBehaviorX: utility.value + (utility.important ? ' !important' : '') 
});

// overscroll-y
export const overscrollY = (utility: ParsedClassToken) => ({ 
  overscrollBehaviorY: utility.value + (utility.important ? ' !important' : '') 
});

// scroll
export const scroll = (utility: ParsedClassToken) => ({ 
  scrollBehavior: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-mx
export const scrollMx = (utility: ParsedClassToken) => ({ 
  scrollMarginLeft: utility.value + (utility.important ? ' !important' : ''), 
  scrollMarginRight: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-my
export const scrollMy = (utility: ParsedClassToken) => ({ 
  scrollMarginTop: utility.value + (utility.important ? ' !important' : ''), 
  scrollMarginBottom: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-mt
export const scrollMt = (utility: ParsedClassToken) => ({ 
  scrollMarginTop: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-mb
export const scrollMb = (utility: ParsedClassToken) => ({ 
  scrollMarginBottom: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-ml
export const scrollMl = (utility: ParsedClassToken) => ({ 
  scrollMarginLeft: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-mr
export const scrollMr = (utility: ParsedClassToken) => ({ 
  scrollMarginRight: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-m
export const scrollM = (utility: ParsedClassToken) => ({ 
  scrollMargin: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-px
export const scrollPx = (utility: ParsedClassToken) => ({ 
  scrollPaddingLeft: utility.value + (utility.important ? ' !important' : ''), 
  scrollPaddingRight: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-py
export const scrollPy = (utility: ParsedClassToken) => ({ 
  scrollPaddingTop: utility.value + (utility.important ? ' !important' : ''), 
  scrollPaddingBottom: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-pt
export const scrollPt = (utility: ParsedClassToken) => ({ 
  scrollPaddingTop: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-pb
export const scrollPb = (utility: ParsedClassToken) => ({ 
  scrollPaddingBottom: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-pl
export const scrollPl = (utility: ParsedClassToken) => ({ 
  scrollPaddingLeft: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-pr
export const scrollPr = (utility: ParsedClassToken) => ({ 
  scrollPaddingRight: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-p
export const scrollP = (utility: ParsedClassToken) => ({ 
  scrollPadding: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-padding
export const scrollPadding = (utility: ParsedClassToken) => ({ 
  scrollPadding: utility.value + (utility.important ? ' !important' : '') 
});

// scroll-margin
export const scrollMargin = (utility: ParsedClassToken) => ({ 
  scrollMargin: utility.value + (utility.important ? ' !important' : '') 
});

// snap
export const snap = (utility: ParsedClassToken) => ({ 
  scrollSnapType: utility.value + (utility.important ? ' !important' : '') 
});

// snap-x
export const snapX = (utility: ParsedClassToken) => ({ 
  scrollSnapType: `x ${utility.value}` + (utility.important ? ' !important' : '') 
});

// snap-y
export const snapY = (utility: ParsedClassToken) => ({ 
  scrollSnapType: `y ${utility.value}` + (utility.important ? ' !important' : '') 
});

// snap-align
export const snapAlign = (utility: ParsedClassToken) => ({ 
  scrollSnapAlign: utility.value + (utility.important ? ' !important' : '') 
}); 