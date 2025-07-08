import {
  isColorValue,
  isLengthValue,
  isNumberValue,
  type ParsedClassToken,
} from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * Divide styles supported by Tailwind CSS v4
 */
const DIVIDE_STYLES = ["solid", "dashed", "dotted", "double", "none"] as const;

/**
 * Check if a value represents a divide style
 */
function isDivideStyleValue(value: string): boolean {
  return DIVIDE_STYLES.includes(value as any);
}

/**
 * divideX utilities for horizontal dividers between children
 * Supports: divide-x, divide-x-2, divide-x-[3px], divide-x-reverse, divide-x-red-500, divide-x-solid
 *
 * Tailwind CSS v4 spec:
 * - divide-x → & > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: 1px; }
 * - divide-x-2 → & > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: 2px; }
 * - divide-x-reverse → --tw-divide-x-reverse: 1;
 */
export const divideX = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? " !important" : "";

  // Handle reverse: divide-x-reverse
  if (utility.value === "reverse") {
    return {
      "--tw-divide-x-reverse": "1" + importantString,
    };
  }

  // Handle zero value specifically: divide-x-0
  if (utility.value === "0") {
    return {
      "& > :not(:last-child)": {
        borderInlineStartWidth: "0px" + importantString,
        borderInlineEndWidth: "0px" + importantString,
      },
    };
  }

  // Handle arbitrary color values: divide-x-[#123456]
  if (
    utility.arbitrary &&
    utility.arbitraryValue &&
    isColorValue(utility.arbitraryValue)
  ) {
    return {
      "& > :not(:last-child)": {
        borderColor: utility.arbitraryValue + importantString,
      },
    };
  }

  // Handle theme colors: divide-x-red-500
  if (utility.value && utility.value.includes('-')) {
    const colorPath = utility.value.replace(/-(\d+)$/, '.$1');
    const css = ctx.config(`theme.colors.${colorPath}`);
    if (css && isColorValue(css)) {
      return {
        "& > :not(:last-child)": {
          borderColor: css + importantString,
        },
      };
    }
  }

  // Handle custom properties: divide-x-(color:--my-color)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("color:", "");
    return {
      "& > :not(:last-child)": {
        borderColor: `var(${value})` + importantString,
      },
    };
  }

  // Handle styles: divide-x-solid, divide-x-dashed, etc.
  if (utility.value && isDivideStyleValue(utility.value)) {
    return {
      "& > :not(:last-child)": {
        borderStyle: utility.value + importantString,
      },
    };
  }

  // Handle no value (divide-x) - default to 1px width
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      "& > :not(:last-child)": {
        borderInlineStartWidth: "0px" + importantString,
        borderInlineEndWidth: "1px" + importantString,
      },
    };
  }

  // Handle arbitrary values: divide-x-[3px]
  if (utility.arbitrary && utility.arbitraryValue && isLengthValue(utility.arbitraryValue)) {
    const value = utility.arbitraryValue;
    const finalValue = isNumberValue(value) ? value + "px" : value;

    return {
      "& > :not(:last-child)": {
        borderInlineStartWidth: "0px" + importantString,
        borderInlineEndWidth: finalValue + importantString,
      },
    };
  }

  // Handle custom properties: divide-x-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    const finalValue = `var(${value})`;

    return {
      "& > :not(:last-child)": {
        borderInlineStartWidth: "0px" + importantString,
        borderInlineEndWidth: finalValue + importantString,
      },
    };
  }

  // Handle numeric values: divide-x-2
  if (utility.numeric && isNumberValue(utility.value)) {
    const value = utility.value + "px";
    return {
      "& > :not(:last-child)": {
        borderInlineStartWidth: "0px" + importantString,
        borderInlineEndWidth: value + importantString,
      },
    };
  }

  return {};
};

/**
 * divideY utilities for vertical dividers between children
 * Supports: divide-y, divide-y-2, divide-y-[3px], divide-y-reverse, divide-y-red-500, divide-y-solid
 *
 * Tailwind CSS v4 spec:
 * - divide-y → & > :not(:last-child) { border-top-width: 0px; border-bottom-width: 1px; }
 * - divide-y-2 → & > :not(:last-child) { border-top-width: 0px; border-bottom-width: 2px; }
 * - divide-y-reverse → --tw-divide-y-reverse: 1;
 */
export const divideY = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? " !important" : "";

  // Handle reverse: divide-y-reverse
  if (utility.value === "reverse") {
    return {
      "--tw-divide-y-reverse": "1" + importantString,
    };
  }

  // Handle zero value specifically: divide-y-0
  if (utility.value === "0") {
    return {
      "& > :not(:last-child)": {
        borderTopWidth: "0px" + importantString,
        borderBottomWidth: "0px" + importantString,
      },
    };
  }

  // Handle arbitrary color values: divide-y-[#123456]
  if (
    utility.arbitrary &&
    utility.arbitraryValue &&
    isColorValue(utility.arbitraryValue)
  ) {
    return {
      "& > :not(:last-child)": {
        borderColor: utility.arbitraryValue + importantString,
      },
    };
  }

  // Handle theme colors: divide-y-red-500
  if (utility.value && utility.value.includes('-')) {
    const colorPath = utility.value.replace(/-(\d+)$/, '.$1');
    const css = ctx.config(`theme.colors.${colorPath}`);
    if (css && isColorValue(css)) {
      return {
        "& > :not(:last-child)": {
          borderColor: css + importantString,
        },
      };
    }
  }

  // Handle custom properties: divide-y-(color:--my-color)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("color:", "");
    return {
      "& > :not(:last-child)": {
        borderColor: `var(${value})` + importantString,
      },
    };
  }

  // Handle styles: divide-y-solid, divide-y-dashed, etc.
  if (utility.value && isDivideStyleValue(utility.value)) {
    return {
      "& > :not(:last-child)": {
        borderStyle: utility.value + importantString,
      },
    };
  }

  // Handle no value (divide-y) - default to 1px width
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return {
      "& > :not(:last-child)": {
        borderTopWidth: "0px" + importantString,
        borderBottomWidth: "1px" + importantString,
      },
    };
  }

  // Handle arbitrary values: divide-y-[3px]
  if (utility.arbitrary && utility.arbitraryValue && isLengthValue(utility.arbitraryValue)) {
    const value = utility.arbitraryValue;
    const finalValue = isNumberValue(value) ? value + "px" : value;

    return {
      "& > :not(:last-child)": {
        borderTopWidth: "0px" + importantString,
        borderBottomWidth: finalValue + importantString,
      },
    };
  }

  // Handle custom properties: divide-y-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    const finalValue = `var(${value})`;

    return {
      "& > :not(:last-child)": {
        borderTopWidth: "0px" + importantString,
        borderBottomWidth: finalValue + importantString,
      },
    };
  }

  // Handle numeric values: divide-y-2
  if (utility.numeric && isNumberValue(utility.value)) {
    const value = utility.value + "px";
    return {
      "& > :not(:last-child)": {
        borderTopWidth: "0px" + importantString,
        borderBottomWidth: value + importantString,
      },
    };
  }

  return {};
};
