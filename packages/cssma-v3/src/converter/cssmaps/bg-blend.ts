import { ParsedClassToken } from "../../parser/utils";

const blendModes = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export function bgBlend(token: ParsedClassToken) {
  if (!token.value || !blendModes.includes(token.value)) return undefined;
  return { backgroundBlendMode: token.value };
}
