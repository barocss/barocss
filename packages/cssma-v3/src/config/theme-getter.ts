// Tailwind 스타일의 theme() 함수 확장
// theme(themeObj, 'colors.blue.500') 또는 theme(themeObj, 'colors', 'blue', 500) 모두 지원

import { CssmaTheme } from "../theme-types";

export function theme(themeObj: CssmaTheme, ...path: (string | number)[]): any {
  let keys: (string | number)[] = [];
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    keys = path[0].split('.');
  } else {
    keys = path;
  }
  return keys.reduce((acc, key) => (acc ? acc[key] : undefined), themeObj);
} 