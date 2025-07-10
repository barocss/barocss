import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS grid-cols-* 유틸리티 완전 대응
// grid-cols-3, grid-cols-none, grid-cols-subgrid, grid-cols-[200px_1fr], grid-cols-(--my-cols) 등

const gridColsMap: Record<string, string> = {
  'none': 'none',
  'subgrid': 'subgrid',
};

function getGridColsValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (grid-cols-(--my-cols))
  if (utility.customProperty && utility.value) {
    return `var(${utility.value})`;
  }
  // arbitrary value (grid-cols-[200px_1fr])
  if (utility.arbitrary && utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  // subgrid
  if (utility.value && gridColsMap[utility.value]) return gridColsMap[utility.value];
  
  // number (grid-cols-3)
  if (utility.value && isNumberValue(utility.value)) {
    return `repeat(${utility.value}, minmax(0, 1fr))`;
  }
  // fallback (raw value)
  if (utility.value) {
    return utility.value;
  }
  return undefined;
}

export const gridCols = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const value = getGridColsValue(utility, ctx);
  if (value === undefined) return {};
  return {
    gridTemplateColumns: value + (utility.important ? ' !important' : '')
  };
}; 