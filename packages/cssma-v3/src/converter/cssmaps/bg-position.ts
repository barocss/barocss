import type { ParsedClassToken } from "../../parser/utils";

const ALLOWED_POSITION = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right"
];

export const bgPosition = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { backgroundPosition: `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { backgroundPosition: utility.arbitraryValue };
  }
  if (ALLOWED_POSITION.includes(utility.value)) {
    return { backgroundPosition: utility.value.replace(/-/g, ' ') };
  }
  return undefined;
}; 