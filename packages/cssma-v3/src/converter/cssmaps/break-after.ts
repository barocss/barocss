import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 break-after converter
 * - break-after-<value> → breakAfter: <value>
 * - !important 지원
 * - arbitrary/custom property 지원
 */
const breakAfterValues = [
  "auto",
  "avoid",
  "all",
  "avoid-page",
  "page",
  "left",
  "right",
  "column",
];

export const breakAfter = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  if (breakAfterValues.includes(utility.value)) {
    return { breakAfter: `${utility.value}${important}` };
  }
  // arbitrary value
  if (utility.arbitrary) {
    return { breakAfter: `${utility.arbitraryValue}${important}` };
  }
  // custom property
  if (utility.customProperty) {
    return { breakAfter: `var(${utility.value})${important}` };
  }
  return undefined;
}; 