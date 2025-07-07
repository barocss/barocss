import type { ParsedClassToken } from "../../parser/utils";

const ALLOWED_BG_SIZE = ["cover", "contain", "auto"];

export const bgSize = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { backgroundSize: `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { backgroundSize: utility.arbitraryValue };
  }
  if (ALLOWED_BG_SIZE.includes(utility.value)) {
    return { backgroundSize: utility.value };
  }
  // 허용되지 않은 값은 undefined 반환
  return undefined;
}; 