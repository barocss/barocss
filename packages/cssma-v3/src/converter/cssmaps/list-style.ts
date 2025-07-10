import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS v4 list-style-type, list-style-position, list-style-image 완전 대응
// list-disc, list-decimal, list-none, list-[upper-roman], list-(--my-marker)
// list-inside, list-outside
// list-image-none, list-image-[url(...)], list-image-(--my-image)

const typeMap: Record<string, string> = {
    'none': 'none',
    'disc': 'disc',
    'circle': 'circle',
    'square': 'square',
    'decimal': 'decimal',
    'decimal-leading-zero': 'decimal-leading-zero',
    'lower-roman': 'lower-roman',
    'upper-roman': 'upper-roman',
    'lower-alpha': 'lower-alpha',
    'upper-alpha': 'upper-alpha',
    'lower-latin': 'lower-latin',
    'upper-latin': 'upper-latin',
    'lower-greek': 'lower-greek',
};

function getListStyleTypeValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // custom property (list-(--my-marker))
  if (utility.customProperty && utility.value) return `var(${utility.value})`;
  // arbitrary value (list-[upper-roman])
  if (utility.arbitrary && utility.arbitraryValue) return utility.arbitraryValue;

  if (utility.value && typeMap[utility.value]) return typeMap[utility.value];

  // fallback
  if (utility.value) return utility.value;
  return undefined;
}

const positionMap: Record<string, string> = {
  'inside': 'inside',
  'outside': 'outside',
};

function getListStylePositionValue(utility: ParsedClassToken) {
  if (utility.value && positionMap[utility.value]) return positionMap[utility.value];
  return undefined;
}

function getListStyleImageValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // list-image-none
  if (utility.value === 'none') return 'none';
  // custom property (list-image-(--my-image))
  if (utility.customProperty && utility.value) return `var(${utility.value})`;
  // arbitrary value (list-image-[url(...)])
  if (utility.arbitrary && utility.arbitraryValue) return utility.arbitraryValue;
  // fallback
  if (utility.value) return utility.value;
  return undefined;
}


export const listStyleImage = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getListStyleImageValue(utility, ctx);
  if (val === undefined) return {};
  return { listStyleImage: val + (utility.important ? ' !important' : '') };
};

// Generic list utility (backward compatibility)
export const list = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const position = getListStylePositionValue(utility);
  if (position) return { listStylePosition: position + (utility.important ? ' !important' : '') };

  const type = getListStyleTypeValue(utility, ctx);
  if (type) return { listStyleType: type + (utility.important ? ' !important' : '') };

  return {};
}; 