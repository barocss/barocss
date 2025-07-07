import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

export const transition = (utility: ParsedClassToken, ctx: CssmaContext) => ({ transitionProperty: utility.value });
export const duration = (utility: ParsedClassToken, ctx: CssmaContext) => ({ transitionDuration: utility.value });
export const delay = (utility: ParsedClassToken, ctx: CssmaContext) => ({ transitionDelay: utility.value });
export const ease = (utility: ParsedClassToken, ctx: CssmaContext) => ({ transitionTimingFunction: ctx.theme?.('ease', utility.value) ?? utility.value }); 