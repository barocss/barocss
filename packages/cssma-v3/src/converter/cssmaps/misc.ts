import { isLengthValue, type ParsedClassToken } from "../../parser/utils";

/**
 * Miscellaneous utilities for Tailwind CSS v4
 * Handles various CSS properties that don't fit into other categories
 */

// writing-mode
export const writingMode = (utility: ParsedClassToken) => ({ 
  writingMode: utility.value + (utility.important ? ' !important' : '') 
});

// content
export const content = (utility: ParsedClassToken) => ({ 
  content: utility.value + (utility.important ? ' !important' : '') 
});

// border-collapse
export const borderCollapse = (utility: ParsedClassToken) => ({ 
  borderCollapse: utility.value 
});

// border-separate
export const borderSeparate = (utility: ParsedClassToken) => ({ 
  borderCollapse: utility.value 
});

// break-inside
export const breakInside = (utility: ParsedClassToken) => ({ 
  breakInside: utility.value 
});

// break-before
export const breakBefore = (utility: ParsedClassToken) => ({ 
  breakBefore: utility.value 
});

// break-after
export const breakAfter = (utility: ParsedClassToken) => ({ 
  breakAfter: utility.value 
});

// mask-type
export const maskType = (utility: ParsedClassToken) => ({ 
  maskType: utility.value + (utility.important ? ' !important' : '') 
});

// mask-size
export const maskSize = (utility: ParsedClassToken) => ({ 
  maskSize: utility.value + (utility.important ? ' !important' : '') 
});

// mask-repeat
export const maskRepeat = (utility: ParsedClassToken) => ({ 
  maskRepeat: utility.value + (utility.important ? ' !important' : '') 
});

// mask-position
export const maskPosition = (utility: ParsedClassToken) => ({ 
  maskPosition: utility.value + (utility.important ? ' !important' : '') 
});

// mask-mode
export const maskMode = (utility: ParsedClassToken) => ({ 
  maskMode: utility.value + (utility.important ? ' !important' : '') 
});

// size
export const size = (utility: ParsedClassToken) => ({ 
  size: utility.value + (utility.important ? ' !important' : '') 
});

// placeholder
export const placeholder = (utility: ParsedClassToken) => ({ 
  color: utility.value + (utility.important ? ' !important' : '') 
});

// color scheme
export const scheme = (utility: ParsedClassToken) => ({ 
  colorScheme: utility.value + (utility.important ? ' !important' : '') 
});

// vertical align
export const sub = () => ({ 
  verticalAlign: 'sub' 
});

export const sup = () => ({ 
  verticalAlign: 'super' 
});

// gradient
export const gradient = (utility: ParsedClassToken) => ({ 
  gradient: utility.value + (utility.important ? ' !important' : '') 
}); 