import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

export const divideX = (utility: ParsedClassToken, ctx: CssmaContext) => ({ borderLeftWidth: utility.value, borderRightWidth: utility.value });
export const divideY = (utility: ParsedClassToken, ctx: CssmaContext) => ({ borderTopWidth: utility.value, borderBottomWidth: utility.value });
export const divide = (utility: ParsedClassToken, ctx: CssmaContext) => ({ borderWidth: utility.value }); 