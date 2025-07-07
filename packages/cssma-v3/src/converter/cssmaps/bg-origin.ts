import type { ParsedClassToken } from "../../parser/utils";

const ALLOWED_ORIGIN = ["border", "padding", "content"];

export const bgOrigin = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (ALLOWED_ORIGIN.includes(utility.value)) {
    return { backgroundOrigin: utility.value + "-box" };
  }
  return undefined;
}; 