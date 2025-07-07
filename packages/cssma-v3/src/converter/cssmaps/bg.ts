import { isColorValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

const positionMap = {
  "top": "top",
  "bottom": "bottom",
  "left": "left",
  "right": "right",
  "center": "center",
  "top-left": "top left",
  "top-right": "top right",
  "bottom-left": "bottom left",
  "bottom-right": "bottom right",
}

// bg (background-color, background-image, bg-none, arbitrary, gradient 등)
// "bg-red-500" → { prefix: "bg", value: "red-500" } → { backgroundColor: "#f56565" }
// "bg-[#123456]" → { prefix: "bg", arbitrary: true, arbitraryValue: "#123456" } → { backgroundColor: "#123456" }
// "bg-red-500!" → { prefix: "bg", value: "red-500", important: true } → { backgroundColor: "#f56565 !important" }
// "bg-(image:<custom-property>)" → { prefix: "bg", arbitrary: true, arbitraryValue: "<custom-property>" } → { backgroundImage: "<custom-property>" }
export const bg = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';

  // 1. bg-none → backgroundImage: 'none'
  if (utility.prefix === "bg-none" && (utility.value === undefined || utility.value === "")) {
    return { backgroundImage: "none" + importantString };
  }

  if (utility.customProperty) {
    return { backgroundColor: `var(${utility.value})` + importantString };
  }
 
  // 3. bg-[url(...)] 또는 arbitrary → backgroundImage
  if (utility.arbitrary) {
    if (utility.arbitraryValue?.startsWith("url(") && utility.arbitraryValue?.endsWith(")")) {
      return { backgroundImage: utility.arbitraryValue + importantString };
    }
    
    if (isColorValue(utility.arbitraryValue!)) {
      return { backgroundColor: utility.arbitraryValue + importantString };
    }

    return undefined;
  }

  // position
  if (utility.value && positionMap[utility.value as keyof typeof positionMap]) {
    return { backgroundPosition: positionMap[utility.value as keyof typeof positionMap] };
  }

  // 4. 나머지 → backgroundColor
  let value = utility.value?.replace(/-/g, '.');
  let css = value === undefined ? undefined : ctx.theme?.('colors', value as string | number) ?? value;
  if (css !== undefined && importantString) css += importantString;
  return { backgroundColor: css };
}; 