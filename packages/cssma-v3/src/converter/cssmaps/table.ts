import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 caption-side utilities
 * https://tailwindcss.com/docs/caption-side
 *
 * Supported classes:
 * - caption-top      → caption-side: top;
 * - caption-bottom   → caption-side: bottom;
 * - !important modifier
 *
 * [참고]
 * - https://tailwindcss.com/docs/caption-side
 */

const captionSideMap: Record<string, string> = {
  'top': 'top',
  'bottom': 'bottom',
};

export function captionSide(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  if (utility.value && captionSideMap[utility.value]) {
    return { captionSide: captionSideMap[utility.value] + important };
  }
  if (utility.value) {
    return { captionSide: utility.value + important };
  }
  return undefined;
}

/**
 * TailwindCSS v4.1 table-layout utilities
 * https://tailwindcss.com/docs/table-layout
 *
 * Supported classes:
 * - table-auto   → table-layout: auto;
 * - table-fixed  → table-layout: fixed;
 * - !important modifier
 *
 * [사용법]
 * <table class="table-auto"> ... </table>
 * <table class="table-fixed"> ... </table>
 *
 * [엣지 케이스]
 * - !important 지원: table-auto! → table-layout: auto !important
 *
 * [참고]
 * - https://tailwindcss.com/docs/table-layout
 */

const tableLayoutMap: Record<string, string> = {
  'auto': 'auto',
  'fixed': 'fixed',
};

export function tableLayout(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // Standard classes
  if (utility.value && tableLayoutMap[utility.value]) {
    return { tableLayout: tableLayoutMap[utility.value] + important };
  }

  // fallback: use as raw value
  if (utility.value) {
    return { tableLayout: utility.value + important };
  }

  return undefined;
}