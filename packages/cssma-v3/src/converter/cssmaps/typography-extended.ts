import type { ParsedClassToken } from "../../parser/utils";

/**
 * Extended Typography utilities for Tailwind CSS v4
 * Handles text overflow, decoration, transformation, and formatting
 */

// truncate
export const truncate = () => ({ 
  overflow: "hidden", 
  textOverflow: "ellipsis", 
  whiteSpace: "nowrap" 
});

// line-clamp
export const lineClamp = (utility: ParsedClassToken) => ({ 
  WebkitLineClamp: utility.value + (utility.important ? ' !important' : '') 
});

// whitespace
export const whitespace = (utility: ParsedClassToken) => ({ 
  whiteSpace: utility.value + (utility.important ? ' !important' : '') 
});

// hyphens
export const hyphens = (utility: ParsedClassToken) => ({ 
  hyphens: utility.value + (utility.important ? ' !important' : '') 
});

// text-ellipsis
export const textEllipsis = () => ({ 
  textOverflow: 'ellipsis' 
});

// text-clip
export const textClip = () => ({ 
  textOverflow: 'clip' 
});


// text-shadow
export const textShadow = (utility: ParsedClassToken) => ({ 
  textShadow: utility.value + (utility.important ? ' !important' : '') 
});

// indent
export const indent = (utility: ParsedClassToken) => ({ 
  textIndent: utility.value + (utility.important ? ' !important' : '') 
});

// overflow-wrap
export const overflowWrap = (utility: ParsedClassToken) => ({ 
  overflowWrap: utility.value + (utility.important ? ' !important' : '') 
});

// break
export const break_ = (utility: ParsedClassToken) => ({ 
  wordBreak: utility.value + (utility.important ? ' !important' : '') 
});

// word
export const word = (utility: ParsedClassToken) => ({ 
  wordBreak: utility.value + (utility.important ? ' !important' : '') 
}); 