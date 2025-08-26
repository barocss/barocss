//  v4.1+ default theme 전체 구조를 최대한 유사하게 구현
//  default theme reference

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

export interface UserTheme {
  [key: string]: any;
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
} as UserTheme; 