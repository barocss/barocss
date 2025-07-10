import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// transform (scale, rotate 등)
// "scale-110" → { prefix: "scale", value: "110" } → { transform: "scale(1.10)" }
// "rotate-45" → { prefix: "rotate", value: "45" } → { transform: "rotate(45deg)" }
export const rotate = (utility: ParsedClassToken) => ({ transform: `rotate(${utility.value}deg)` + (utility.important ? ' !important' : '') }); 