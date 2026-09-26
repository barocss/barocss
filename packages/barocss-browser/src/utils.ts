// #335: class lists split on ASCII whitespace only, as HTML classList and Tailwind's candidate scanner do;
// a non-ASCII space (U+00A0, U+3000, ...) is part of a token, which then matches no utility.
const CLASS_SEPARATOR = /[ \t\n\f\r]+/;

export function normalizeClassName(className: any): string {
    if (!className) return '';
  
    if (typeof className === 'object' && typeof className.baseVal === 'string') {
      return className.baseVal;
    }
  
    return className.toString();
  }
  
export function normalizeClassNameList(className: any): string[] {
    if (!className) return [];
    return normalizeClassName(className).split(CLASS_SEPARATOR).filter(Boolean);
}
