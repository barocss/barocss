import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS flex-* 유틸리티 완전 대응
// flex-1, flex-2, flex-1/2, flex-auto, flex-initial, flex-none, flex-(--my-flex), flex-[3_1_auto] 등

const flexMap: Record<string, string> = {
  '1': '1 1 auto',
  '2': '2 1 auto',
  'auto': '1 1 auto',
  'initial': '0 1 auto',
  'none': 'none',
};

function getFlexValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (flex-(--my-flex))
  if (utility.customProperty && utility.value) return `var(${utility.value})`;
  // arbitrary value (flex-[3_1_auto])
  if (utility.arbitrary && utility.arbitraryValue) return utility.arbitraryValue;
  // fraction (flex-1/2)
  if (utility.value && utility.slash) {
    const result = Number(utility.value) / Number(utility.slash);
    return `calc(${result} * 100%)`;
  }
  // special keywords
  if (utility.value) {
    if (flexMap[utility.value]) return flexMap[utility.value];
  }
  // number (flex-1, flex-2, ...)
  if (utility.value && isNumberValue(utility.value)) {
    return utility.value;
  }
  // fallback (raw value)
  if (utility.value) return utility.value;
  return undefined;
}

export const flex = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getFlexValue(utility, ctx);
  if (val === undefined) return {};
  return { flex: val + (utility.important ? ' !important' : '') };
}; 