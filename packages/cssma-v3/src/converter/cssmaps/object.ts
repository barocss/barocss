import type { ParsedClassToken } from "../../parser/utils";

export const object = (utility: ParsedClassToken) => {
  // object-fit, object-position 등 value에 따라 분기
  const fitValues = ["contain", "cover", "fill", "none", "scale-down"];
  if (fitValues.includes(utility.value)) return { objectFit: utility.value };
  // position
  return { objectPosition: utility.value };
}; 