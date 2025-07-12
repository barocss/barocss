import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 columns converter
 * - columns-<number> → columns: <number>
 * - columns-<size> (e.g. xs, sm, md, ...) → columns: var(--container-<size>)
 * - columns-auto → columns: auto
 * - columns-[<value>] → columns: <value>
 * - columns-(--custom) → columns: var(--custom)
 */
export const columns = (utility: ParsedClassToken, ctx?: CssmaContext) => {
  const important = utility.important ? " !important" : "";
  // columns-auto
  if (utility.value === "auto") {
    return { columns: `auto${important}` };
  }
  // columns-<number>
  if (utility.value && isNumberValue(utility.value)) {
    return { columns: `${utility.value}${important}` };
  }
  // columns-<size> (xs, sm, md, ...)
  if (utility.value && ctx) {
    const sizeMatch = ctx.theme(`container.${utility.value}`);
    if (sizeMatch) {
      return { columns: `var(--container-${utility.value})${important}` };
    }
  }
  // columns-(--custom)
  if (utility.customProperty) {
    return { columns: `var(${utility.value})${important}` };
  }
  // columns-[value] (arbitrary)
  if (utility.arbitrary) {
    return { columns: `${utility.arbitraryValue}${important}` };
  }
  return undefined;
}; 