import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 box-decoration-break converter
 * - box-decoration-slice → boxDecorationBreak: slice
 * - box-decoration-clone → boxDecorationBreak: clone
 * - !important 지원
 * - arbitrary/custom property 지원
 */
const boxDecorationBreakValues = [
  "slice",
  "clone",
];

export const boxDecorationBreak = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  if (boxDecorationBreakValues.includes(utility.value)) {
    return { boxDecorationBreak: `${utility.value}${important}` };
  }
  return undefined;
}; 