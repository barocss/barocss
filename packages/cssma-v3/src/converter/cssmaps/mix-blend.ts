import { ParsedClassToken } from "../../parser/utils";

const blendModeMap: Record<string, string> = {
  "normal": "normal",
  "multiply": "multiply",
  "screen": "screen",
  "overlay": "overlay",
  "darken": "darken",
  "lighten": "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  "difference": "difference",
  "exclusion": "exclusion",
  "hue": "hue",
  "saturation": "saturation",
  "color": "color",
  "luminosity": "luminosity",
  "plus-lighter": "plus-lighter",
};

export function mixBlend(token: ParsedClassToken) {
  const important = token.important ? ' !important' : '';
  const { value } = token;

  if (value && blendModeMap[value]) {
    return { mixBlendMode: blendModeMap[value] + important };
  }

  return undefined;
} 