import type { ParsedClassToken } from "../../parser/utils";

const directionToAngle = {
  'to-t': 'to top',
  'to-b': 'to bottom',
  'to-l': 'to left',
  'to-r': 'to right',
  'to-tl': 'to top left',
  'to-tr': 'to top right',
  'to-bl': 'to bottom left',
  'to-br': 'to bottom right',
};

export const bgLinear = (utility: ParsedClassToken) => {

  // 1. 커스텀 프로퍼티
  if (utility.customProperty) {
    return {
      backgroundImage: `linear-gradient(var(--tw-gradient-stops, var(${utility.customProperty})))`
    };
  }
  // 2. arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      '--linear-gradient': utility.arbitraryValue,
      backgroundImage: `linear-gradient(var(--tw-gradient-stops, var(--linear-gradient)))`
    };
  }
  // 3. direction/angle + slash(interpolation)
  let main = utility.value;
  let interpolation = utility.slash;
  let angleOrDir = directionToAngle[main as keyof typeof directionToAngle] ?? main;
  // negative 옵션 처리 (각도에만 적용)
  if (utility.negative && typeof angleOrDir === 'string' && /^\d+(deg)?$/.test(angleOrDir)) {
    angleOrDir = '-' + (angleOrDir.endsWith('deg') ? angleOrDir : angleOrDir + 'deg');
  }
  let inClause = interpolation ? ` in ${interpolation}` : '';
  return {
    backgroundImage: `linear-gradient(${angleOrDir}${inClause}, var(--tw-gradient-stops))`
  };
};