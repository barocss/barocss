import type { ParsedClassToken } from "../../parser/utils";

export const bgConic = (utility: ParsedClassToken) => {
  // 1. 커스텀 프로퍼티
  if (utility.customProperty && utility.value) {
    return {
      backgroundImage: `var(${utility.value})`
    };
  }
  // 2. arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      '--conic-gradient': utility.arbitraryValue,
      backgroundImage: `conic-gradient(var(--tw-gradient-stops, var(--conic-gradient)))`
    };
  }
  // 3. from/at/angle + slash(interpolation) + negative
  let main = utility.value;
  let negative = utility.negative;
  let interpolation = utility.slash || "oklab";
  let inClause = interpolation ? ` in ${interpolation}` : '';
  if (main) {
    return {
      backgroundImage: `conic-gradient(from ${negative ? '-' : ''}${main}${inClause}, var(--tw-gradient-stops))`
    };
  }
  // 4. 기본값
  return {
    backgroundImage: `conic-gradient(in oklab, var(--tw-gradient-stops))`
  };
}; 