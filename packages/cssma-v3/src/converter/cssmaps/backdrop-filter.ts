import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 backdrop-blur filter utility
 * https://tailwindcss.com/docs/backdrop-blur
 */
export function backdropBlur(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  const themeBlur = ctx.theme?.("blur", value);
  if (themeBlur) {
    return { backdropFilter: `blur(${themeBlur})` + important };
  }
  if (customProperty && value) {
    return { backdropFilter: `blur(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `blur(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `blur(${value}px)` + important };
  }
  if (value === "none" || value === "0") {
    return { backdropFilter: "" };
  }
  if (!value || value === "") {
    return { backdropFilter: "blur(8px)" + important };
  }
  return { backdropFilter: `blur(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-brightness filter utility
 * https://tailwindcss.com/docs/backdrop-brightness
 */
export function backdropBrightness(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `brightness(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `brightness(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `brightness(${value}%)` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "brightness(1)" + important };
  }
  return { backdropFilter: `brightness(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-contrast filter utility
 * https://tailwindcss.com/docs/backdrop-contrast
 */
export function backdropContrast(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `contrast(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `contrast(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `contrast(${value}%)` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "contrast(1)" + important };
  }
  return { backdropFilter: `contrast(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-drop-shadow filter utility
 * https://tailwindcss.com/docs/backdrop-drop-shadow
 */
export function backdropDropShadow(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (value === "none" || value === "0") {
    return { backdropFilter: "" };
  }
  if (customProperty && value) {
    if (value && value.startsWith("color:")) {
      const colorVar = value.replace("color:", "");
      return { "--tw-backdrop-drop-shadow-color": `var(${colorVar})` };
    }
    return { backdropFilter: `drop-shadow(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `drop-shadow(${arbitraryValue})` + important };
  }
  // theme lookup, fallback 등은 실제 Tailwind와 맞추려면 추가 구현 필요
  if (!value || value === "") {
    return { backdropFilter: "drop-shadow(var(--backdrop-drop-shadow))" + important };
  }
  return { backdropFilter: `drop-shadow(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-grayscale filter utility
 * https://tailwindcss.com/docs/backdrop-grayscale
 */
export function backdropGrayscale(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `grayscale(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `grayscale(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `grayscale(${value})` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "grayscale(1)" + important };
  }
  return { backdropFilter: `grayscale(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-hue-rotate filter utility
 * https://tailwindcss.com/docs/backdrop-hue-rotate
 */
export function backdropHueRotate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `hue-rotate(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `hue-rotate(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `hue-rotate(${value}deg)` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "hue-rotate(0deg)" + important };
  }
  return { backdropFilter: `hue-rotate(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-invert filter utility
 * https://tailwindcss.com/docs/backdrop-invert
 */
export function backdropInvert(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `invert(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `invert(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `invert(${value})` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "invert(1)" + important };
  }
  return { backdropFilter: `invert(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-saturate filter utility
 * https://tailwindcss.com/docs/backdrop-saturate
 */
export function backdropSaturate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `saturate(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `saturate(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `saturate(${value}%)` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "saturate(100%)" + important };
  }
  return { backdropFilter: `saturate(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-sepia filter utility
 * https://tailwindcss.com/docs/backdrop-sepia
 */
export function backdropSepia(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { backdropFilter: `sepia(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { backdropFilter: `sepia(${arbitraryValue})` + important };
  }
  if (value && !isNaN(Number(value))) {
    return { backdropFilter: `sepia(${value})` + important };
  }
  if (!value || value === "") {
    return { backdropFilter: "sepia(1)" + important };
  }
  return { backdropFilter: `sepia(${value})` + important };
}

/**
 * TailwindCSS v4.1 backdrop-filter utility
 * https://tailwindcss.com/docs/backdrop-filter
 *
 * 지원:
 * - backdrop-filter-none
 * - backdrop-filter-(<custom-property>)
 * - backdrop-filter-[<value>]
 * - !important modifier
 *
 * @param utility ParsedClassToken
 * @param ctx CssmaContext
 * @returns { [key: string]: string }
 */
export function backdropFilter(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, customProperty, arbitrary, arbitraryValue } = utility;

  if (value === 'none') {
    return { backdropFilter: `none${important}` };
  }

  if (customProperty && value) {
    // backdrop-filter-(--my-filter) → backdrop-filter: var(--my-filter)
    return { backdropFilter: `var(${value})${important}` };
  }

  if (arbitrary && arbitraryValue) {
    // backdrop-filter-[url('filters.svg#filter-id')] → backdrop-filter: url('filters.svg#filter-id')
    return { backdropFilter: `${arbitraryValue}${important}` };
  }

  // fallback: treat as custom value (should not happen in normal Tailwind usage)
  return { backdropFilter: `${value}${important}` };
} 