import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 box-sizing converter
 * - box-border → boxSizing: border-box
 * - box-content → boxSizing: content-box
 * - !important 지원
 */
const boxSizingValues = {
  "border": "border-box",
  "content": "content-box",
};

export const boxSizing = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  const cssValue = boxSizingValues[utility.value as keyof typeof boxSizingValues];
  if (cssValue) {
    return { boxSizing: `${cssValue}${important}` };
  }
  return undefined;
}; 