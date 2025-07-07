import { CssmaTheme } from "../theme-types";

export function hasPreset(themeObj: CssmaTheme, category: string, preset: string): any {
  return themeObj[category]?.includes(preset);
} 