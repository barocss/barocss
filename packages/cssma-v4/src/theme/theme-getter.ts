// Tailwind 스타일의 theme() 함수 (v4)
// theme(themeObj, 'colors.red.500') 또는 theme(themeObj, 'colors', 'red', 500) 모두 지원

/**
 * Tailwind-style theme getter
 * - Only supports function at category (first path segment) level.
 * - Leaf (property) functions are NOT supported (will be ignored).
 * - Example: theme('spacing') can be a function, theme('spacing.1') cannot.
 *
 * @param path - dot string or array path
 * @returns value from theme object, or undefined if not found
 */
export function createThemeGetter(themeObject: Record<string, any>) {
  function theme(path: string | string[]): any {
    const pathArr = Array.isArray(path) ? path : path.split('.');
    if (pathArr.length === 0) return undefined;
    const [category, ...rest] = pathArr;
    let value = themeObject[category];
    // Only execute function at category level
    if (typeof value === 'function') {
      value = value(theme);
    }
    // Traverse the rest of the path, do NOT execute functions at leaf
    for (const key of rest) {
      if (value == null) return undefined;
      value = value[key];
    }
    // If the final value is a function (leaf), do NOT execute, just return as is (or undefined)
    if (typeof value === 'function') {
      // Option 1: return undefined to avoid confusion
      return undefined;
      // Option 2: return the function itself (unexecuted)
      // return value;
    }
    return value;
  }
  return theme;
} 