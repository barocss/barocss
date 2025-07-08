import type { ParsedClassToken } from "../../parser/utils";

/**
 * Interactivity utilities for Tailwind CSS v4
 * Handles user interaction properties like cursor, user-select, appearance, resize
 */

// user-select
export const userSelect = (utility: ParsedClassToken) => ({ 
  userSelect: utility.value + (utility.important ? ' !important' : '') 
});

// select
export const select = (utility: ParsedClassToken) => ({ 
  select: utility.value + (utility.important ? ' !important' : '') 
});

// cursor
export const cursor = (utility: ParsedClassToken) => ({ 
  cursor: utility.value + (utility.important ? ' !important' : '') 
});

// accent-color
export const accent = (utility: ParsedClassToken) => ({ 
  accentColor: utility.value + (utility.important ? ' !important' : '') 
});

// caret-color
export const caret = (utility: ParsedClassToken) => ({ 
  caretColor: utility.value + (utility.important ? ' !important' : '') 
});

// field-sizing
export const fieldSizing = (utility: ParsedClassToken) => ({ 
  fieldSizing: utility.value + (utility.important ? ' !important' : '') 
});

// field-sizing-fixed
export const fieldSizingFixed = () => ({ 
  fieldSizing: 'fixed' 
});

// field-sizing-content
export const fieldSizingContent = () => ({ 
  fieldSizing: 'content' 
}); 