import type { ParsedClassToken } from "../../parser/utils";
export const bgGradientTo = (utility: ParsedClassToken) => ({
  backgroundImage: `linear-gradient(${utility.value}, var(--tw-gradient-stops))`,
}); 