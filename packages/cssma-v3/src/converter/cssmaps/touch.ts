/**
 * TailwindCSS v4.1 touch-action utilities
 * https://tailwindcss.com/docs/touch-action
 *
 * Supported classes:
 * - touch-auto
 * - touch-none
 * - touch-pan-x, touch-pan-left, touch-pan-right
 * - touch-pan-y, touch-pan-up, touch-pan-down
 * - touch-pinch-zoom
 * - touch-manipulation
 * - !important modifier
 */

import { ParsedClassToken } from "../../parser/utils";

const touchActionMap: Record<string, string> = {
  'auto': 'auto',
  'none': 'none',
  'pan-x': 'pan-x',
  'pan-left': 'pan-left',
  'pan-right': 'pan-right',
  'pan-y': 'pan-y',
  'pan-up': 'pan-up',
  'pan-down': 'pan-down',
  'pinch-zoom': 'pinch-zoom',
  'manipulation': 'manipulation',
};

export const touch = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  
  // Standard classes
  const value = touchActionMap[utility.value];
  if (value) {
    return { touchAction: value + important };
  }
  return undefined;
}; 