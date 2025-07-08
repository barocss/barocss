import type { ParsedClassToken } from "../../parser/utils";

/**
 * Transform utilities for Tailwind CSS v4
 * Handles CSS transforms: translate, rotate, scale, skew, perspective, backface-visibility
 */

// transform-origin
export const origin = (utility: ParsedClassToken) => ({ 
  transformOrigin: utility.value + (utility.important ? ' !important' : '') 
});

// transform
export const transform = (utility: ParsedClassToken) => ({ 
  transform: utility.value + (utility.important ? ' !important' : '') 
});

// transform-origin
export const transformOrigin = (utility: ParsedClassToken) => ({ 
  transformOrigin: utility.value + (utility.important ? ' !important' : '') 
});

// transform-style
export const transformStyle = (utility: ParsedClassToken) => ({ 
  transformStyle: utility.value + (utility.important ? ' !important' : '') 
});

// translate
export const translate = (utility: ParsedClassToken) => ({ 
  transform: `translate(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-x
export const translateX = (utility: ParsedClassToken) => ({ 
  transform: `translateX(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-y
export const translateY = (utility: ParsedClassToken) => ({ 
  transform: `translateY(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-z
export const translateZ = (utility: ParsedClassToken) => ({ 
  transform: `translateZ(${utility.value})` + (utility.important ? ' !important' : '') 
});

// skew
export const skew = (utility: ParsedClassToken) => ({ 
  transform: `skew(${utility.value})` + (utility.important ? ' !important' : '') 
});

// skew-x
export const skewX = (utility: ParsedClassToken) => ({ 
  transform: `skewX(${utility.value})` + (utility.important ? ' !important' : '') 
});

// skew-y
export const skewY = (utility: ParsedClassToken) => ({ 
  transform: `skewY(${utility.value})` + (utility.important ? ' !important' : '') 
});

// scale-x
export const scaleX = (utility: ParsedClassToken) => ({ 
  transform: `scaleX(${utility.value})` + (utility.important ? ' !important' : '') 
});

// scale-y
export const scaleY = (utility: ParsedClassToken) => ({ 
  transform: `scaleY(${utility.value})` + (utility.important ? ' !important' : '') 
});

// scale-z
export const scaleZ = (utility: ParsedClassToken) => ({ 
  transform: `scaleZ(${utility.value})` + (utility.important ? ' !important' : '') 
});

// rotate-x
export const rotateX = (utility: ParsedClassToken) => ({ 
  transform: `rotateX(${utility.value})` + (utility.important ? ' !important' : '') 
});

// rotate-y
export const rotateY = (utility: ParsedClassToken) => ({ 
  transform: `rotateY(${utility.value})` + (utility.important ? ' !important' : '') 
});

// rotate-z
export const rotateZ = (utility: ParsedClassToken) => ({ 
  transform: `rotateZ(${utility.value})` + (utility.important ? ' !important' : '') 
});

// perspective
export const perspective = (utility: ParsedClassToken) => ({ 
  perspective: utility.value + (utility.important ? ' !important' : '') 
});

// perspective-origin
export const perspectiveOrigin = (utility: ParsedClassToken) => ({ 
  perspectiveOrigin: utility.value + (utility.important ? ' !important' : '') 
});

// backface-hidden
export const backfaceHidden = () => ({ 
  backfaceVisibility: 'hidden' 
});

// backface-visible
export const backfaceVisible = () => ({ 
  backfaceVisibility: 'visible' 
});

// backface-visibility
export const backfaceVisibility = (utility: ParsedClassToken) => ({ 
  backfaceVisibility: utility.value + (utility.important ? ' !important' : '') 
}); 