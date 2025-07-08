import type { ParsedClassToken } from "../../parser/utils";

/**
 * Effects utilities for Tailwind CSS v4
 * Handles visual effects like filter, backdrop-filter, mix-blend-mode, drop-shadow
 */

// filter
export const filter = (utility: ParsedClassToken) => ({ 
  filter: utility.value + (utility.important ? ' !important' : '') 
});

// backdrop-filter
export const backdrop = (utility: ParsedClassToken) => ({ 
  backdropFilter: utility.value + (utility.important ? ' !important' : '') 
});

// mix-blend-mode
export const mixBlend = (utility: ParsedClassToken) => ({ 
  mixBlendMode: utility.value + (utility.important ? ' !important' : '') 
});

// drop-shadow
export const dropShadow = (utility: ParsedClassToken) => ({ 
  filter: `drop-shadow(${utility.value})` + (utility.important ? ' !important' : '') 
}); 