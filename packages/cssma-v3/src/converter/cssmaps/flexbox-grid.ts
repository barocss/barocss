import type { ParsedClassToken } from "../../parser/utils";

/**
 * Flexbox & Grid utilities for Tailwind CSS v4
 * Handles alignment, justification, placement, and ordering
 */

// order
export const order = (utility: ParsedClassToken) => ({ 
  order: utility.value + (utility.important ? ' !important' : '') 
});

// place-content
export const placeContent = (utility: ParsedClassToken) => ({ 
  placeContent: utility.value + (utility.important ? ' !important' : '') 
});

// place-items
export const placeItems = (utility: ParsedClassToken) => ({ 
  placeItems: utility.value + (utility.important ? ' !important' : '') 
});

// place-self
export const placeSelf = (utility: ParsedClassToken) => ({ 
  placeSelf: utility.value + (utility.important ? ' !important' : '') 
});

// align-content
export const alignContent = (utility: ParsedClassToken) => ({ 
  alignContent: utility.value + (utility.important ? ' !important' : '') 
});

// align-items
export const alignItems = (utility: ParsedClassToken) => ({ 
  alignItems: utility.value + (utility.important ? ' !important' : '') 
});

// align-self
export const alignSelf = (utility: ParsedClassToken) => ({ 
  alignSelf: utility.value + (utility.important ? ' !important' : '') 
});

// justify-items
export const justifyItems = (utility: ParsedClassToken) => ({ 
  justifyItems: utility.value + (utility.important ? ' !important' : '') 
});

// justify-self
export const justifySelf = (utility: ParsedClassToken) => ({ 
  justifySelf: utility.value + (utility.important ? ' !important' : '') 
}); 