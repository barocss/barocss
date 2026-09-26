export function normalizeClassName(className: any): string {
    if (!className) return '';
  
    if (typeof className === 'object' && typeof className.baseVal === 'string') {
      return className.baseVal;
    }
  
    return className.toString();
  }
  
export function normalizeClassNameList(className: any): string[] {
    if (!className) return [];
    return normalizeClassName(className).split(/\s+/).filter(Boolean);
}
