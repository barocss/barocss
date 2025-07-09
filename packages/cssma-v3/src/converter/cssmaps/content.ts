import type { ParsedClassToken } from "../../parser/utils";

/**
 * Content utilities for Tailwind CSS v4
 * Handles the content property for pseudo-elements
 */

const contentMap: Record<string, string> = {
  'none': 'none',
};

// content: content-none, content-[attr(data-content)], content-["Hello_World"]
export const content = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  if (utility.prefix && contentMap[utility.value]) {
    return { content: contentMap[utility.value] + importantString };
  }
  
  if (utility.arbitrary && utility.arbitraryValue) {
    return { content: utility.arbitraryValue + importantString };
  }

  if (utility.customProperty) {
    return { content: `var(${utility.value})` + importantString };
  }
  
  return {};
}; 