import { isLengthValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * rounded (border-radius)
 * rounded → border-radius: 0.25rem;
 * rounded-md → border-radius: 0.375rem;
 * rounded-[4px] → border-radius: 4px; (arbitrary)
 * rounded-(length:--my-radius) → border-radius: var(--my-radius); (custom property)
 */
export function rounded(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderRadius: "0.25rem" + importantString };
  }

  // Handle arbitrary values: rounded-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { borderRadius: utility.arbitraryValue + importantString };
  }

  // Handle custom properties: rounded-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return { borderRadius: `var(${value})` + importantString };
  }

  // Handle theme values: rounded-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return { borderRadius: radius + importantString };
    }
  }

  return undefined;
}

/**
 * rounded-s (logical start border-radius)
 */
export function roundedS(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-s) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderStartStartRadius: "0.25rem" + importantString,
      borderEndStartRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-s-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue + importantString;
    return {
      borderStartStartRadius: value,
      borderEndStartRadius: value,
    };
  }

  // Handle custom properties: rounded-s-(length:--my-radius)
  if (utility.customProperty && utility.value) {
      const value = utility.value.replace("length:", "");
    return {
      borderStartStartRadius: `var(${value})` + importantString,
      borderEndStartRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-s-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderStartStartRadius: value,
        borderEndStartRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-e (logical end border-radius)
 */
export function roundedE(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-e) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    const value = "0.25rem" + importantString;
    return {
      borderStartEndRadius: value,
      borderEndEndRadius: value,
    };
  }

  // Handle arbitrary values: rounded-e-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue + importantString;
    return {
      borderStartEndRadius: value,
      borderEndEndRadius: value,
    };
  }

  // Handle custom properties: rounded-e-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderStartEndRadius: `var(${value})` + importantString,
      borderEndEndRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-e-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderStartEndRadius: value,
        borderEndEndRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-t (top border-radius)
 */
export function roundedT(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-t) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    const value = "0.25rem" + importantString;
    return {
      borderTopLeftRadius: value,
      borderTopRightRadius: value,
    };
  }

  // Handle arbitrary values: rounded-t-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      const value = utility.arbitraryValue + importantString;
      return {
        borderTopLeftRadius: value,
        borderTopRightRadius: value,
      };
    }
  }

  // Handle custom properties: rounded-t-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderTopLeftRadius: `var(${value})` + importantString,
      borderTopRightRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-t-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderTopLeftRadius: value,
        borderTopRightRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-r (right border-radius)
 */
export function roundedR(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-r) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    const value = "0.25rem" + importantString;
    return {
      borderTopRightRadius: value,
      borderBottomRightRadius: value,
    };
  }

  // Handle arbitrary values: rounded-r-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      const value = utility.arbitraryValue + importantString;
      return {
        borderTopRightRadius: value,
        borderBottomRightRadius: value,
      };
    }
  }

  // Handle custom properties: rounded-r-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderTopRightRadius: `var(${value})` + importantString,
      borderBottomRightRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-r-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderTopRightRadius: value,
        borderBottomRightRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-b (bottom border-radius)
 */
export function roundedB(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-b) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    const value = "0.25rem" + importantString;
    return {
      borderBottomRightRadius: value,
      borderBottomLeftRadius: value,
    };
  }

  // Handle arbitrary values: rounded-b-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      const value = utility.arbitraryValue + importantString;
      return {
        borderBottomRightRadius: value,
        borderBottomLeftRadius: value,
      };
    }
  }

  // Handle custom properties: rounded-b-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderBottomRightRadius: `var(${value})` + importantString,
      borderBottomLeftRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-b-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderBottomRightRadius: value,
        borderBottomLeftRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-l (left border-radius)
 */
export function roundedL(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-l) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    const value = "0.25rem" + importantString;
    return {
      borderTopLeftRadius: value,
      borderBottomLeftRadius: value,
    };
  }

  // Handle arbitrary values: rounded-l-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      const value = utility.arbitraryValue + importantString;
      return {
        borderTopLeftRadius: value,
        borderBottomLeftRadius: value,
      };
    }
  }

  // Handle custom properties: rounded-l-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderTopLeftRadius: `var(${value})` + importantString,
      borderBottomLeftRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-l-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      const value = radius + importantString;
      return {
        borderTopLeftRadius: value,
        borderBottomLeftRadius: value,
      };
    }
  }

  return undefined;
}

/**
 * rounded-tl (top-left border-radius)
 */
export function roundedTl(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-tl) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderTopLeftRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-tl-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      return {
        borderTopLeftRadius: utility.arbitraryValue + importantString,
      };
    };
  }

  // Handle custom properties: rounded-tl-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderTopLeftRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-tl-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderTopLeftRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-tr (top-right border-radius)
 */
export function roundedTr(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-tr) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderTopRightRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-tr-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      return {
        borderTopRightRadius: utility.arbitraryValue + importantString,
      };
    };
  }

  // Handle custom properties: rounded-tr-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderTopRightRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-tr-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderTopRightRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-br (bottom-right border-radius)
 */
export function roundedBr(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-br) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderBottomRightRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-br-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      return {
        borderBottomRightRadius: utility.arbitraryValue + importantString,
      };
    }
  }

  // Handle custom properties: rounded-br-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderBottomRightRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-br-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderBottomRightRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-bl (bottom-left border-radius)
 */
export function roundedBl(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-bl) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderBottomLeftRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-bl-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    if (isLengthValue(utility.arbitraryValue)) {
      return {
        borderBottomLeftRadius: utility.arbitraryValue + importantString,
      };
    }
  }

  // Handle custom properties: rounded-bl-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderBottomLeftRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-bl-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderBottomLeftRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-ss (logical start-start border-radius)
 * In LTR: top-left corner
 * In RTL: top-right corner
 */
export function roundedSs(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-ss) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderStartStartRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-ss-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      borderStartStartRadius: utility.arbitraryValue + importantString,
    };
  }

  // Handle custom properties: rounded-ss-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderStartStartRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-ss-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderStartStartRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-se (logical start-end border-radius)
 * In LTR: top-right corner
 * In RTL: top-left corner
 */
export function roundedSe(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-se) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderStartEndRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-se-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      borderStartEndRadius: utility.arbitraryValue + importantString,
    };
  }

  // Handle custom properties: rounded-se-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderStartEndRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-se-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderStartEndRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-es (logical end-start border-radius)
 * In LTR: bottom-left corner
 * In RTL: bottom-right corner
 */
export function roundedEs(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-es) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderEndStartRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-es-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      borderEndStartRadius: utility.arbitraryValue + importantString,
    };
  }

  // Handle custom properties: rounded-es-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderEndStartRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-es-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderEndStartRadius: radius + importantString,
      };
    }
  }

  return undefined;
}

/**
 * rounded-ee (logical end-end border-radius)
 * In LTR: bottom-right corner
 * In RTL: bottom-left corner
 */
export function roundedEe(utility: ParsedClassToken, ctx: CssmaContext) {
  const importantString = utility.important ? " !important" : "";
  // Handle no value (rounded-ee) - default value
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      borderEndEndRadius: "0.25rem" + importantString,
    };
  }

  // Handle arbitrary values: rounded-ee-[4px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      borderEndEndRadius: utility.arbitraryValue + importantString,
    };
  }

  // Handle custom properties: rounded-ee-(length:--my-radius)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("length:", "");
    return {
      borderEndEndRadius: `var(${value})` + importantString,
    };
  }

  // Handle theme values: rounded-ee-md
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) {
      return {
        borderEndEndRadius: radius + importantString,
      };
    }
  }

  return undefined;
}
