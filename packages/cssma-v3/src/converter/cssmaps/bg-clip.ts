import type { ParsedClassToken } from "../../parser/utils";

const ALLOWED_CLIP = ["border", "padding", "content", "text"];

export const bgClip = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (!ALLOWED_CLIP.includes(utility.value)) return undefined;
  if (utility.value === "text") {
    return { backgroundClip: "text" };
  }
  return { backgroundClip: utility.value + "-box" };
}; 