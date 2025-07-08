import type { ParsedClassToken } from "../../parser/utils";

/**
 * SVG utilities for Tailwind CSS v4
 * Handles SVG-specific properties like fill, stroke, stroke-width
 */

// fill
export const fill = (utility: ParsedClassToken) => ({ 
  fill: utility.value + (utility.important ? ' !important' : '') 
});

// stroke
export const stroke = (utility: ParsedClassToken) => ({ 
  stroke: utility.value + (utility.important ? ' !important' : '') 
});

// stroke-width
export const strokeWidth = (utility: ParsedClassToken) => ({ 
  strokeWidth: utility.value + (utility.important ? ' !important' : '') 
}); 