import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 float converter (prefix 기반)
 * - { prefix: 'float-right', value: '' } → float: right
 * - { prefix: 'float-left', value: '' } → float: left
 * - { prefix: 'float-start', value: '' } → float: inline-start
 * - { prefix: 'float-end', value: '' } → float: inline-end
 * - { prefix: 'float-none', value: '' } → float: none
 * - !important 지원
 */
const floatValues: Record<string, string> = {
  'float-right': 'right',
  'float-left': 'left',
  'float-start': 'inline-start',
  'float-end': 'inline-end',
  'float-none': 'none',
};

export const float = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  if (floatValues[utility.prefix] !== undefined) {
    return { float: floatValues[utility.prefix] + important };
  }
  return undefined;
}; 