import type { ParsedClassToken } from "../../parser/utils";

/**
 * Vertical alignment utilities for Tailwind CSS v4
 * Handles vertical-align property only (text-align moved to text-unified.ts)
 */

const alignMap: Record<string, string> = {
  'baseline': 'baseline',
  'top': 'top',
  'middle': 'middle',
  'bottom': 'bottom',
  'text-top': 'text-top',
  'text-bottom': 'text-bottom',
  'sub': 'sub',
  'super': 'super'
};

// vertical-align: align-baseline, align-top, align-middle, align-bottom, align-text-top, align-text-bottom, align-sub, align-super, align-[value]
export const verticalAlign = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: align-[2px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { verticalAlign: utility.arbitraryValue + importantString };
  }

  if (utility.customProperty) {
    return { verticalAlign: `var(${utility.value})` + importantString };
  }

  if (utility.prefix && utility.value === '') {
    return { verticalAlign: utility.prefix + importantString };
  }
  
  const align = alignMap[utility.value];
  if (align) {
    return { verticalAlign: align + importantString };
  }
  
  return {};
}; 