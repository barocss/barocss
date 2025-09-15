export function splitClassName(className: string): string[] {
    return className.split(/\s+/).filter(Boolean);
}


export function normalizeClassName(className: any): string {
    if (!className) return '';
  
    if (className instanceof SVGAnimatedString) {
      return className.baseVal.toString();
    }
  
    return className.toString();
  }
  
export function normalizeClassNameList(className: any): string[] {
    if (!className) return [];
    return splitClassName(normalizeClassName(className));
}