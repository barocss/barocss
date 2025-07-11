import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 blur filter utility
 * https://tailwindcss.com/docs/filter-blur
 *
 * Supported classes:
 * - blur, blur-xs, blur-sm, blur-md, blur-lg, blur-xl, blur-2xl, blur-3xl, blur-0
 * - blur-(--custom), blur-[arbitrary]
 * - !important modifier
 */
export function blur(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;

  // Named sizes (xs, sm, md, lg, xl, 2xl, 3xl)
  const themeBlur = ctx.theme?.("blur", value);
  if (themeBlur) {
    return { filter: `blur(${themeBlur})` + important };
  }

  if (customProperty && value) {
    return { filter: `blur(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `blur(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `blur(${value}px)` + important };
  }
  if (value === "none" || value === "0") {
    return { filter: "" };
  }
  if (!value || value === "") {
    // Default: blur(8px)
    return { filter: "blur(8px)" + important };
  }
  return { filter: `blur(${value})` + important };
}

/**
 * TailwindCSS v4.1 brightness filter utility
 * https://tailwindcss.com/docs/filter-brightness
 */
export function brightness(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `brightness(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `brightness(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `brightness(${value}%)` + important };
  }
  if (!value || value === "") {
    return { filter: "brightness(1)" + important };
  }
  return { filter: `brightness(${value})` + important };
}

/**
 * TailwindCSS v4.1 contrast filter utility
 * https://tailwindcss.com/docs/filter-contrast
 */
export function contrast(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `contrast(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `contrast(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `contrast(${value}%)` + important };
  }
  if (!value || value === "") {
    return { filter: "contrast(1)" + important };
  }
  return { filter: `contrast(${value})` + important };
}

/**
 * TailwindCSS v4.1 drop-shadow filter utility
 * https://tailwindcss.com/docs/filter-drop-shadow
 *
 * 지원:
 * - drop-shadow, drop-shadow-xs, drop-shadow-sm, drop-shadow-md, drop-shadow-lg, drop-shadow-xl, drop-shadow-2xl, drop-shadow-none
 * - drop-shadow-(--custom), drop-shadow-[arbitrary]
 * - drop-shadow-(color:--custom), drop-shadow-[color:...] (색상 전용)
 * - drop-shadow-inherit, drop-shadow-current, drop-shadow-transparent, drop-shadow-black, drop-shadow-white, drop-shadow-red-500 등 색상 전용
 * - !important modifier
 */
export function dropShadow(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;

  // drop-shadow-none
  if (value === "none" || value === "0") {
    return { filter: "" };
  }

  // drop-shadow-(--custom) → filter: drop-shadow(var(--custom))
  if (customProperty && value) {
    // drop-shadow-(color:--custom) 등 색상 전용 (별도 처리 필요)
    if (value && value.startsWith("color:")) {
      const colorVar = value.replace("color:", "");
      return { "--tw-drop-shadow-color": `var(${colorVar})` };
    }

    return { filter: `drop-shadow(var(${value}))` + important };
  }

  // drop-shadow-[arbitrary] → filter: drop-shadow(<arbitraryValue>)
  if (arbitrary && arbitraryValue) {
    return { filter: `drop-shadow(${arbitraryValue})` + important };
  }

  // drop-shadow-inherit, drop-shadow-current, drop-shadow-transparent, drop-shadow-black, drop-shadow-white 등 색상 전용

  const colorPath = value?.replace(/-/g, ".");
  const color = ctx.theme?.(`colors.${colorPath}`);
  if (value && color) {
    // Tailwind는 --tw-drop-shadow-color: var(--color-<value>);
    if (["inherit", "current", "transparent"].includes(value)) {
      return {
        "--tw-drop-shadow-color": value === "current" ? "currentColor" : value,
      };
    }
    return { [`--tw-drop-shadow-color`]: `var(--color-${value})` };
  }

  // theme lookup: drop-shadow, drop-shadow-sm, drop-shadow-md, ...
  // Tailwind는 filter: drop-shadow(var(--drop-shadow-<size>))
  const themeKey = value || "DEFAULT";
  const themeVar = ctx.theme?.(`dropShadow.${themeKey}`);
  console.log(themeVar, value, themeKey);
  if (themeVar) {
    // Tailwind는 filter: drop-shadow(var(--drop-shadow-<size>))
    // themeVar이 이미 var(--drop-shadow-*) 형태라면 그대로, 아니면 감싸기
    const isVar = typeof themeVar === "string" && themeVar.startsWith("var(");
    return {
      filter:
        `drop-shadow(${isVar ? themeVar : `var(--drop-shadow-${themeKey})`})` +
        important,
    };
  }

  // drop-shadow (기본값)
  if (!value || value === "") {
    // Tailwind 기본값: drop-shadow(var(--drop-shadow))
    return { filter: "drop-shadow(var(--drop-shadow))" + important };
  }

  // 기타: 임의 값 등
  return { filter: `drop-shadow(${value})` + important };
}

/**
 * TailwindCSS v4.1 grayscale filter utility
 * https://tailwindcss.com/docs/filter-grayscale
 */
export function grayscale(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `grayscale(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `grayscale(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `grayscale(${value})` + important };
  }
  if (!value || value === "") {
    return { filter: "grayscale(1)" + important };
  }
  return { filter: `grayscale(${value})` + important };
}

/**
 * TailwindCSS v4.1 hue-rotate filter utility
 * https://tailwindcss.com/docs/filter-hue-rotate
 */
export function hueRotate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `hue-rotate(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `hue-rotate(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `hue-rotate(${value}deg)` + important };
  }
  if (!value || value === "") {
    return { filter: "hue-rotate(0deg)" + important };
  }
  return { filter: `hue-rotate(${value})` + important };
}

/**
 * TailwindCSS v4.1 invert filter utility
 * https://tailwindcss.com/docs/filter-invert
 */
export function invert(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `invert(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `invert(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `invert(${value})` + important };
  }
  if (!value || value === "") {
    return { filter: "invert(1)" + important };
  }
  return { filter: `invert(${value})` + important };
}

/**
 * TailwindCSS v4.1 saturate filter utility
 * https://tailwindcss.com/docs/filter-saturate
 */
export function saturate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `saturate(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `saturate(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `saturate(${value}%)` + important };
  }
  if (!value || value === "") {
    return { filter: "saturate(100%)" + important };
  }
  return { filter: `saturate(${value})` + important };
}

/**
 * TailwindCSS v4.1 sepia filter utility
 * https://tailwindcss.com/docs/filter-sepia
 */
export function sepia(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? " !important" : "";
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { filter: `sepia(var(${value}))` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { filter: `sepia(${arbitraryValue})` + important };
  }
  if (value && isNumberValue(value)) {
    return { filter: `sepia(${value})` + important };
  }
  if (!value || value === "") {
    return { filter: "sepia(1)" + important };
  }
  return { filter: `sepia(${value})` + important };
}
