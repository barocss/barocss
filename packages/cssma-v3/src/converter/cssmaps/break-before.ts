import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 break-before converter
 * - break-before-<value> → breakBefore: <value>
 * - !important 지원
 * - arbitrary/custom property 지원
 */
const breakBeforeValues = [
  "auto",
  "avoid",
  "all",
  "avoid-page",
  "page",
  "left",
  "right",
  "column",
];

export const breakBefore = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  if (breakBeforeValues.includes(utility.value)) {
    return { breakBefore: `${utility.value}${important}` };
  }
  // arbitrary value
  if (utility.arbitrary) {
    return { breakBefore: `${utility.arbitraryValue}${important}` };
  }
  // custom property
  if (utility.customProperty) {
    return { breakBefore: `var(${utility.value})${important}` };
  }
  return undefined;
}; 