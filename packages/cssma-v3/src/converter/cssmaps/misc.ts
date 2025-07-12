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

// size
export const size = (utility: ParsedClassToken) => ({ 
  size: utility.value + (utility.important ? ' !important' : '') 
});

// placeholder
export const placeholder = (utility: ParsedClassToken) => ({ 
  color: utility.value + (utility.important ? ' !important' : '') 
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