import { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 cursor utilities
 * https://tailwindcss.com/docs/cursor
 *
 * Supported classes:
 * - cursor-auto, cursor-default, cursor-pointer, ... (all standard)
 * - cursor-(<custom-property>)
 * - cursor-[arbitrary]
 * - !important modifier
 */

const cursorMap: Record<string, string> = {
  'auto': 'auto',
  'default': 'default',
  'pointer': 'pointer',
  'wait': 'wait',
  'text': 'text',
  'move': 'move',
  'help': 'help',
  'not-allowed': 'not-allowed',
  'none': 'none',
  'context-menu': 'context-menu',
  'progress': 'progress',
  'cell': 'cell',
  'crosshair': 'crosshair',
  'vertical-text': 'vertical-text',
  'alias': 'alias',
  'copy': 'copy',
  'no-drop': 'no-drop',
  'grab': 'grab',
  'grabbing': 'grabbing',
  'all-scroll': 'all-scroll',
  'col-resize': 'col-resize',
  'row-resize': 'row-resize',
  'n-resize': 'n-resize',
  'e-resize': 'e-resize',
  's-resize': 's-resize',
  'w-resize': 'w-resize',
  'ne-resize': 'ne-resize',
  'nw-resize': 'nw-resize',
  'se-resize': 'se-resize',
  'sw-resize': 'sw-resize',
  'ew-resize': 'ew-resize',
  'ns-resize': 'ns-resize',
  'nesw-resize': 'nesw-resize',
  'nwse-resize': 'nwse-resize',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
};

export function cursor(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';

  // cursor-(--custom) → cursor: var(--custom)
  if (utility.customProperty && utility.value) {
    return { cursor: `var(${utility.value})` + important };
  }

  // cursor-[arbitrary] → cursor: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    return { cursor: utility.arbitraryValue + important };
  }

  // Standard classes
  const value = cursorMap[utility.value ?? ''];
  if (value) {
    return { cursor: value + important };
  }
  return undefined;
} 