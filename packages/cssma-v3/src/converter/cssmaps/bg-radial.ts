import type { ParsedClassToken } from "../../parser/utils";

export const bgRadial = (utility: ParsedClassToken) => {

  if (utility.prefix === 'bg-radial' && utility.value === "") {
    return {
      backgroundImage: `radial-gradient(in oklab, var(--tw-gradient-stops))`
    };
  }

  // 1. 커스텀 프로퍼티
  if (utility.customProperty && utility.value) {
    return {
      backgroundImage: `radial-gradient(var(--tw-gradient-stops, var(${utility.value})))`
    };
  }
  // 2. arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      '--radial-gradient': utility.arbitraryValue,
      backgroundImage: `radial-gradient(var(--tw-gradient-stops, var(--radial-gradient)))`
    };
  }
  // 3. shape/at/size + slash(interpolation)
  let main = utility.value;
  let interpolation = utility.slash;
  let inClause = interpolation ? ` in ${interpolation}` : '';
  if (main) {
    return {
      backgroundImage: `radial-gradient(${main}${inClause}, var(--tw-gradient-stops))`
    };
  }
  // 4. 기본값
  return {
    backgroundImage: `radial-gradient(var(--tw-gradient-stops))`
  };
}; 