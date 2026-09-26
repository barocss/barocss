//  default theme structure implemented to closely match reference
// Default theme reference

import { colors } from './colors';
import { spacing } from './spacing';
import { borderRadius } from './border-radius';
import { fontSize } from './font-size';
import { fontFamily } from './font-family';
import { fontWeight } from './font-weight';
import { lineHeight } from './line-height';
import { boxShadow } from './box-shadow';
import { zIndex } from './z-index';
import { opacity } from './opacity';
import { transitionProperty } from './transition-property';
import { transitionTimingFunction } from './transition-timing-function';
import { transitionDuration } from './transition-duration';
import { transitionDelay } from './transition-delay';
import { animations } from './animations';
import { keyframes } from './keyframes';
import { animationVars } from './animation-vars';
import { breakpoints } from './breakpoints';
import { container } from './container';
import { letterSpacing } from './letter-spacing';
import { blur } from './blur';
import { textShadow, dropShadow } from './text-shadow';

export interface UserTheme {
  [key: string]: unknown;
}

export const defaultTheme = {
  colors,
  spacing,
  borderRadius,
  breakpoints,
  container,
  fontSize,
  fontFamily,
  fontWeight,
  letterSpacing,
  lineHeight,
  boxShadow,
  zIndex,
  opacity,
  transitionProperty,
  transitionTimingFunction,
  transitionDuration,
  transitionDelay,
  animations,
  keyframes,
  animationVars,
  blur,
  textShadow,
  dropShadow,
  // Tailwind 4.1.13 --aspect-* (aspect-video → var(--aspect-video))
  aspect: { video: '16 / 9' },
} as UserTheme; 