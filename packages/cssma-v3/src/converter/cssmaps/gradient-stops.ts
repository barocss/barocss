import { isLengthValue, type ParsedClassToken } from "../../parser/utils";

/**
 * Gradient Stop utilities for Tailwind CSS v4
 * Handles gradient color and position stops: from, via, to
 */

// Tailwind v4 gradient stop utilities
export const from = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-from': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-from': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-from-position': utility.value };
  }
  return { '--tw-gradient-from': utility.value };
};

export const via = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-via': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-via': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-via-position': utility.value };
  }
  return { '--tw-gradient-via': utility.value };
};

export const to = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-to': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-to': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-to-position': utility.value };
  }
  return { '--tw-gradient-to': utility.value };
}; 