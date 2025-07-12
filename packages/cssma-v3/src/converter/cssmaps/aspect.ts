import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 aspect-ratio converter
 * - aspect-<ratio> → aspectRatio: <ratio>
 * - aspect-square → aspectRatio: 1 / 1
 * - aspect-video → aspectRatio: var(--aspect-ratio-video) (16/9)
 * - aspect-auto → aspectRatio: auto
 * - aspect-[<value>] → aspectRatio: <value>
 * - aspect-(--custom) → aspectRatio: var(--custom)
 * - aspect-<theme> → aspectRatio: theme value (ex: --aspect-retro)
 */
export const aspect = (utility: ParsedClassToken, ctx?: CssmaContext) => {
  // !important 지원
  const important = utility.important ? " !important" : "";

  // aspect-square
  if (utility.value === "square") {
    return { aspectRatio: `1 / 1${important}` };
  }
  // aspect-video
  if (utility.value === "video") {
    // Tailwind v4.1: var(--aspect-ratio-video) (16/9)
    return { aspectRatio: `var(--aspect-ratio-video)${important}` };
  }
  // aspect-auto
  if (utility.value === "auto") {
    return { aspectRatio: `auto${important}` };
  }
  // aspect-(--custom)
  if (utility.customProperty && utility.value) {
    return { aspectRatio: `var(${utility.value})${important}` };
  }
  // aspect-[<value>]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { aspectRatio: `${utility.arbitraryValue}${important}` };
  }
  // aspect-<theme> (ex: aspect-retro → var(--aspect-retro))
  if (utility.value && ctx) {
    // theme 변수 우선, 없으면 var(--aspect-<value>)
    const themeVar = ctx.theme(`aspectRatio.${utility.value}`);
    if (themeVar) {
      return { aspectRatio: `${themeVar}${important}` };
    }
    return { aspectRatio: `var(--aspect-${utility.value})${important}` };
  }
  // aspect-<ratio> (ex: aspect-3/2)
  if (utility.value && utility.slash) {
    return { aspectRatio: `${utility.value}/${utility.slash}${important}` };
  }
  return undefined;
}; 