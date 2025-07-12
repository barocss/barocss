import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 break-inside converter
 * - break-inside-<value> → breakInside: <value>
 * - !important 지원
 * - arbitrary/custom property 지원
 */
const breakInsideValues = [
  "auto",
  "avoid",
  "avoid-page",
  "avoid-column",
];

export const breakInside = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  if (breakInsideValues.includes(utility.value)) {
    return { breakInside: `${utility.value}${important}` };
  }
  // arbitrary value
  if (utility.arbitrary) {
    return { breakInside: `${utility.arbitraryValue}${important}` };
  }
  // custom property
  if (utility.customProperty) {
    return { breakInside: `var(${utility.value})${important}` };
  }
  return undefined;
}; 