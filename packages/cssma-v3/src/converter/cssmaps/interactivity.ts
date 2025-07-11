import type { ParsedClassToken } from "../../parser/utils";

/**
 * Interactivity utilities for Tailwind CSS v4
 * Handles user interaction properties like cursor, user-select, appearance, resize
 */

// accent-color
export const accent = (utility: ParsedClassToken) => ({ 
  accentColor: utility.value + (utility.important ? ' !important' : '') 
});

// caret-color
export const caret = (utility: ParsedClassToken) => ({ 
  caretColor: utility.value + (utility.important ? ' !important' : '') 
});

// field-sizing
const fieldSizingMap: Record<string, string> = {
  'fixed': 'fixed',
  'content': 'content',
};

export const fieldSizing = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  if (utility.value && fieldSizingMap[utility.value]) {
    return { fieldSizing: fieldSizingMap[utility.value] + important };
  }
  return undefined;
};