import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

export const animate = (utility: ParsedClassToken, ctx: CssmaContext) => ({ animation: ctx.theme?.('animation', utility.value) ?? utility.value }); 