import type { ParsedClassToken } from "../../parser/utils";

/**
 * Layout utilities for Tailwind CSS v4
 * Handles position, display, overflow, visibility, z-index, float, clear, and box-sizing
 */

const appearanceMap: Record<string, string> = {
  'auto': 'auto',
  'none': 'none',
};

// appearance
export const appearance = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  if (utility.value && appearanceMap[utility.value]) {
    return { appearance: appearanceMap[utility.value] + important };
  }
  return { appearance: 'auto' + important };
};

// overflow
export const overflow = (utility: ParsedClassToken) => ({ 
  overflow: utility.value + (utility.important ? ' !important' : '') 
});

export const overflowX = (utility: ParsedClassToken) => ({ 
  overflowX: utility.value + (utility.important ? ' !important' : '') 
});

export const overflowY = (utility: ParsedClassToken) => ({ 
  overflowY: utility.value + (utility.important ? ' !important' : '') 
});

// isolation
export const isolation = (utility: ParsedClassToken) => ({ 
  isolation: utility.value + (utility.important ? ' !important' : '') 
});

// z-index
export const z = (utility: ParsedClassToken) => ({ 
  zIndex: utility.value + (utility.important ? ' !important' : '') 
});

// position values
export const inset = (utility: ParsedClassToken) => ({ 
  inset: utility.value + (utility.important ? ' !important' : '') 
});

export const top = (utility: ParsedClassToken) => ({ 
  top: utility.value + (utility.important ? ' !important' : '') 
});

export const left = (utility: ParsedClassToken) => ({ 
  left: utility.value + (utility.important ? ' !important' : '') 
});

export const right = (utility: ParsedClassToken) => ({ 
  right: utility.value + (utility.important ? ' !important' : '') 
});

export const bottom = (utility: ParsedClassToken) => ({ 
  bottom: utility.value + (utility.important ? ' !important' : '') 
});

// box-sizing
export const box = (utility: ParsedClassToken) => ({ 
  boxSizing: utility.value 
});

// box-decoration-break
export const boxDecoration = (utility: ParsedClassToken) => ({ 
  boxDecorationBreak: utility.value 
});

// visibility
export const visible = () => ({ 
  visibility: 'visible' 
});

export const invisible = () => ({ 
  visibility: 'hidden' 
});

export const collapse = () => ({ 
  visibility: 'collapse' 
});

// display
export const display = (utility: ParsedClassToken) => ({ 
  display: utility.value 
});

// container
export const container = () => ({ 
  containerType: 'inline-size' 
});

// position
export const static_ = () => ({ 
  position: 'static' 
});

export const fixed = () => ({ 
  position: 'fixed' 
});

export const absolute = () => ({ 
  position: 'absolute' 
});

export const relative = () => ({ 
  position: 'relative' 
});

export const sticky = () => ({ 
  position: 'sticky' 
});

// float
export const float = (utility: ParsedClassToken) => ({ 
  float: utility.value + (utility.important ? ' !important' : '') 
});

// clear
export const clear = (utility: ParsedClassToken) => ({ 
  clear: utility.value + (utility.important ? ' !important' : '') 
});

const pointerEventsMap: Record<string, string> = {
  'auto': 'auto',
  'none': 'none',
};

// pointer-events
export const pointerEvents = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  if (utility.value && pointerEventsMap[utility.value]) {
    return { pointerEvents: pointerEventsMap[utility.value] + important };
  }
  return { pointerEvents: 'auto' + important };
};

// sr-only
export const srOnly = () => ({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0'
});

// not-sr-only
export const notSrOnly = () => ({
  position: 'static',
  width: 'auto',
  height: 'auto',
  padding: '0',
  margin: '0',
  overflow: 'visible',
  clip: 'auto',
  whiteSpace: 'normal'
}); 