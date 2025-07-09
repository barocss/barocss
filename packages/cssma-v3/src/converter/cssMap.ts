
// Tailwind 주요 유틸리티 → CSS 속성/값 매핑 테이블/함수
import type { ParsedClassToken } from "../parser/utils";
import type { CssmaContext } from "../theme-types";
import { bg } from "./cssmaps/bg";
import { bgLinear } from "./cssmaps/bg-linear";
import { bgRadial } from "./cssmaps/bg-radial";
import { bgConic } from "./cssmaps/bg-conic";
import { bgNoRepeat } from "./cssmaps/bg-no-repeat";
import { bgRepeat } from "./cssmaps/bg-repeat";
import { bgOrigin } from "./cssmaps/bg-origin";
import { bgClip } from "./cssmaps/bg-clip";
import { bgBlend } from "./cssmaps/bg-blend";
import { bgFixed } from "./cssmaps/bg-fixed";
import { bgLocal } from "./cssmaps/bg-local";
import { bgScroll } from "./cssmaps/bg-scroll";
import { text } from "./cssmaps/text-unified";
import {
  m,
  mx,
  my,
  mt,
  mb,
  ml,
  mr,
  p,
  px,
  py,
  pt,
  pb,
  pl,
  pr,
} from "./cssmaps/spacing";
import {
  border,
  borderT,
  borderB,
  borderL,
  borderR,
  borderX,
  borderY,
  borderS,
  borderE,
} from "./cssmaps/border";
import { shadow, opacity } from "./cssmaps/effect";
import { w, h, minW, maxW, minH, maxH } from "./cssmaps/sizing";
// Typography utilities (new structure)
import {
  font,
  fontStyle,
  fontSmoothing,
  fontVariantNumeric,
} from "./cssmaps/font";
import { verticalAlign } from "./cssmaps/text-align";
import {
  textDecoration,
  textDecorationLine,
  underlineOffset,
} from "./cssmaps/text-decoration";
import {
  textIndent,
  whiteSpace,
  wordBreak,
  overflowWrap as overflowWrapNew,
  hyphens as hyphensNew,
  lineHeight,
  letterSpacing,
  lineClamp as lineClampNew,
} from "./cssmaps/text-layout";
import {
  textTransform,
  textShadow as textShadowNew,
} from "./cssmaps/text-effects";
import {
  listStyleType as listStyleTypeNew,
  listStylePosition,
  listStyleImage,
} from "./cssmaps/list-style";
import { content } from "./cssmaps/content";

import { flex, gridCols, gap, items, justify } from "./cssmaps/flexgrid";
import { scale, rotate } from "./cssmaps/transform";
import { table, tableRow, tableCell } from "./cssmaps/table";
// Layout utilities
import {
  appearance,
  overflow,
  overflowX,
  overflowY,
  isolation,
  z,
  inset,
  top,
  left,
  right,
  bottom,
  box,
  boxDecoration,
  visible,
  invisible,
  collapse,
  display,
  container,
  static_ as staticUtil,
  fixed as fixedUtil,
  absolute as absoluteUtil,
  relative as relativeUtil,
  sticky as stickyUtil,
  float,
  clear,
  pointerEvents,
  resize,
  srOnly,
  notSrOnly,
} from "./cssmaps/layout";

// Flexbox & Grid utilities
import {
  order,
  placeContent,
  placeItems,
  placeSelf,
  alignContent,
  alignItems,
  alignSelf,
  justifyItems,
  justifySelf,
} from "./cssmaps/flexbox-grid";

// Interactivity utilities
import {
  userSelect,
  select,
  cursor,
  accent,
  caret,
  fieldSizing,
  fieldSizingFixed,
  fieldSizingContent,
} from "./cssmaps/interactivity";

// Transform utilities
import {
  origin,
  transform,
  transformOrigin,
  transformStyle,
  translate,
  translateX,
  translateY,
  translateZ,
  skew,
  skewX,
  skewY,
  scaleX,
  scaleY,
  scaleZ,
  rotateX,
  rotateY,
  rotateZ,
  perspective,
  perspectiveOrigin,
  backfaceHidden,
  backfaceVisible,
  backfaceVisibility,
} from "./cssmaps/transforms";

// Typography extended utilities
import {
  list,
  word,
} from "./cssmaps/typography-extended";

// Effects utilities
import { mixBlend, filter, backdrop, dropShadow } from "./cssmaps/effects";

// SVG utilities
import { fill, stroke, strokeWidth } from "./cssmaps/svg";

// Scroll utilities
import {
  overscroll,
  overscrollX,
  overscrollY,
  scroll,
  scrollMx,
  scrollMy,
  scrollMt,
  scrollMb,
  scrollMl,
  scrollMr,
  scrollM,
  scrollPx,
  scrollPy,
  scrollPt,
  scrollPb,
  scrollPl,
  scrollPr,
  scrollP,
  scrollPadding,
  scrollMargin,
  snap,
  snapX,
  snapY,
  snapAlign,
} from "./cssmaps/scroll";

// Miscellaneous utilities
import {
  writingMode,
  borderCollapse,
  borderSeparate,
  breakInside,
  breakBefore,
  breakAfter,
  maskType,
  maskSize,
  maskRepeat,
  maskPosition,
  maskMode,
  size,
  placeholder,
  scheme,
  sub,
  sup,
  gradient,
} from "./cssmaps/misc";

// Gradient stop utilities
import { from, via, to } from "./cssmaps/gradient-stops";

import { bgGradient } from "./cssmaps/bg-gradient";
import { bgGradientTo } from "./cssmaps/bg-gradient-to";
import { aspect } from "./cssmaps/aspect";
import { object } from "./cssmaps/object";
import { ring } from "./cssmaps/ring";
import { transition, duration, delay, ease } from "./cssmaps/transition";
import { animate } from "./cssmaps/animate";
import { bgSize } from "./cssmaps/bg-size";
import { bgPosition } from "./cssmaps/bg-position";
import {
  rounded,
  roundedB,
  roundedBl,
  roundedBr,
  roundedE,
  roundedEe,
  roundedEs,
  roundedL,
  roundedR,
  roundedS,
  roundedSe,
  roundedSs,
  roundedT,
  roundedTl,
  roundedTr,
} from "./cssmaps/rounded";
import { outline, outlineOffset } from "./cssmaps/outline";
import { divideX, divideY } from "./cssmaps/divide";

type CssmaCssValue = string | { [key: string]: string | undefined } | undefined;

export const utilityToCss: Record<
  string,
  (
    utility: ParsedClassToken,
    context: CssmaContext
  ) => Record<string, CssmaCssValue> | undefined
> = {
  bg: bg,
  "bg-none": bg,
  "bg-blend": bgBlend,
  "bg-clip": bgClip,
  "bg-origin": bgOrigin,
  "bg-repeat": bgRepeat,
  "bg-no-repeat": bgNoRepeat,
  "bg-size": bgSize,
  "bg-position": bgPosition,
  "bg-fixed": bgFixed,
  "bg-local": bgLocal,
  "bg-scroll": bgScroll,
  m: m,
  mx: mx,
  my: my,
  mt: mt,
  mb: mb,
  ml: ml,
  mr: mr,
  p: p,
  px: px,
  py: py,
  pt: pt,
  pb: pb,
  pl: pl,
  pr: pr,
  border: border,
  "border-t": borderT,
  "border-b": borderB,
  "border-l": borderL,
  "border-r": borderR,
  "border-x": borderX,
  "border-y": borderY,
  "border-s": borderS,
  "border-e": borderE,
  "rounded-ss": roundedSs,
  "rounded-se": roundedSe,
  "rounded-es": roundedEs,
  "rounded-ee": roundedEe,
  "rounded-bl": roundedBl,
  "rounded-br": roundedBr,
  "rounded-tl": roundedTl,
  "rounded-tr": roundedTr,
  "rounded-b": roundedB,
  "rounded-l": roundedL,
  "rounded-r": roundedR,
  "rounded-t": roundedT,
  "rounded-s": roundedS,
  "rounded-e": roundedE,
  rounded: rounded,

  shadow: shadow,
  opacity: opacity,
  w: w,
  h: h,
  "min-w": minW,
  "max-w": maxW,
  "min-h": minH,
  "max-h": maxH,

  // font utilities
  italic: fontStyle,
  "not-italic": fontStyle,
  
  // Font smoothing keywords
  antialiased: fontSmoothing,
  "subpixel-antialiased": fontSmoothing,
  
  // Font variant numeric keywords
  "normal-nums": fontVariantNumeric,
  ordinal: fontVariantNumeric,
  "slashed-zero": fontVariantNumeric,
  "lining-nums": fontVariantNumeric,
  "oldstyle-nums": fontVariantNumeric,
  "proportional-nums": fontVariantNumeric,
  "tabular-nums": fontVariantNumeric,
  "diagonal-fractions": fontVariantNumeric,
  "stacked-fractions": fontVariantNumeric,
  
  // Font utilities with values
  font: font,
  align: verticalAlign,
  underline: textDecorationLine,
  overline: textDecorationLine,
  "line-through": textDecorationLine,
  "no-underline": textDecorationLine,
  decoration: textDecoration,
  "underline-offset": underlineOffset,
  
  // Text layout with values
  indent: textIndent,
  whitespace: whiteSpace,
  break: wordBreak,
  hyphens: hyphensNew,
  leading: lineHeight,
  tracking: letterSpacing,
  "line-clamp": lineClampNew,

  // Text effects utilities (new structure)
  uppercase: textTransform,
  lowercase: textTransform,
  capitalize: textTransform,
  "normal-case": textTransform,
  "text-shadow": textShadowNew,
  "trancate": text,
  text: text,

  content: content,

  // List style utilities (new structure)
  "list-style-type": listStyleTypeNew,
  "list-style-position": listStylePosition,
  "list-style-image": listStyleImage,
  "list-inside": listStylePosition,
  "list-outside": listStylePosition,
  "list-image": listStyleImage,

  flex: flex,
  "grid-cols": gridCols,
  gap: gap,
  items: items,
  justify: justify,
  scale: scale,
  rotate: rotate,
  table: table,
  "table-row": tableRow,
  "table-cell": tableCell,
  appearance: appearance,
  "writing-mode": writingMode,
  "user-select": userSelect,
  float: float,
  clear: clear,
  overflow: overflow,
  "overflow-x": overflowX,
  "overflow-y": overflowY,
  "pointer-events": pointerEvents,
  select: select,
  resize: resize,
  isolation: isolation,
  "mix-blend": mixBlend,
  filter: filter,
  backdrop: backdrop,
  z: z,
  order: order,
  "place-content": placeContent,
  "place-items": placeItems,
  "place-self": placeSelf,
  "align-content": alignContent,
  "align-items": alignItems,
  "align-self": alignSelf,
  "justify-items": justifyItems,
  "justify-self": justifySelf,
  inset: inset,
  top: top,
  left: left,
  right: right,
  bottom: bottom,
  aspect: aspect,
  object: object,
  ring: ring,
  "divide-x": divideX,
  "divide-y": divideY,
  transition: transition,
  duration: duration,
  delay: delay,
  ease: ease,
  animate: animate,
  box: box,
  "box-decoration": boxDecoration,
  "border-collapse": borderCollapse,
  "border-separate": borderSeparate,
  "drop-shadow": dropShadow,
  "break-inside": breakInside,
  "break-before": breakBefore,
  "break-after": breakAfter,
  "outline-offset": outlineOffset,
  outline: outline,
  accent: accent,
  caret: caret,
  fill: fill,
  scheme: scheme,
  visible: visible,
  invisible: invisible,
  collapse: collapse,
  display: display,
  container: container,
  cursor: cursor,
  placeholder: placeholder,
  static: staticUtil,
  fixed: fixedUtil,
  absolute: absoluteUtil,
  relative: relativeUtil,
  sticky: stickyUtil,
  sub: sub,
  sup: sup,
  "sr-only": srOnly,
  "not-sr-only": notSrOnly,
  list: list,
  "mask-type": maskType,
  "mask-size": maskSize,
  "mask-repeat": maskRepeat,
  "mask-position": maskPosition,
  "mask-mode": maskMode,
  overscroll: overscroll,
  "overscroll-x": overscrollX,
  "overscroll-y": overscrollY,
  scroll: scroll,
  "scroll-mx": scrollMx,
  "scroll-my": scrollMy,
  "scroll-mt": scrollMt,
  "scroll-mb": scrollMb,
  "scroll-ml": scrollMl,
  "scroll-mr": scrollMr,
  "scroll-m": scrollM,
  "scroll-px": scrollPx,
  "scroll-py": scrollPy,
  "scroll-pt": scrollPt,
  "scroll-pb": scrollPb,
  "scroll-pl": scrollPl,
  "scroll-pr": scrollPr,
  "scroll-p": scrollP,
  "scroll-padding": scrollPadding,
  "scroll-margin": scrollMargin,
  snap: snap,
  "snap-x": snapX,
  "snap-y": snapY,
  "snap-align": snapAlign,
  origin: origin,
  transform: transform,
  "transform-origin": transformOrigin,
  "transform-style": transformStyle,
  translate: translate,
  "translate-x": translateX,
  "translate-y": translateY,
  "translate-z": translateZ,
  skew: skew,
  "skew-x": skewX,
  "skew-y": skewY,
  "scale-x": scaleX,
  "scale-y": scaleY,
  "scale-z": scaleZ,
  "rotate-x": rotateX,
  "rotate-y": rotateY,
  "rotate-z": rotateZ,
  perspective: perspective,
  "perspective-origin": perspectiveOrigin,
  "backface-hidden": backfaceHidden,
  "backface-visible": backfaceVisible,
  "backface-visibility": backfaceVisibility,
  "field-sizing": fieldSizing,
  "field-sizing-fixed": fieldSizingFixed,
  "field-sizing-content": fieldSizingContent,
  size: size,
  stroke: stroke,
  "stroke-width": strokeWidth,
  "bg-gradient": bgGradient,
  "bg-gradient-to": bgGradientTo,
  "bg-linear": bgLinear,
  "bg-radial": bgRadial,
  "bg-conic": bgConic,
  from: from,
  via: via,
  to: to,
  gradient: gradient,
  word: word,

};
