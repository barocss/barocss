import { rotate } from "./cssmaps/rotate";

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
import { shadow, opacity, insetShadow } from "./cssmaps/effect";
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
  hyphens as hyphensNew,
  lineHeight,
  letterSpacing,
  lineClamp as lineClampNew,
} from "./cssmaps/text-layout";
import {
  textTransform,
  textShadow as textShadowNew,
} from "./cssmaps/text-effects";
import { list, listStyleImage } from "./cssmaps/list-style";
import { content } from "./cssmaps/content";

import {
  alignContent,
  alignItems,
  alignSelf,
  justify,
  justifyItems,
  justifySelf,
  placeContent,
  placeItems,
  placeSelf,
} from "./cssmaps/flexgrid";
import { captionSide, tableLayout } from "./cssmaps/table";
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
  srOnly,
  notSrOnly,
} from "./cssmaps/layout";

// Flexbox & Grid utilities
import { order } from "./cssmaps/flexbox-grid";

// Interactivity utilities
import { fieldSizing } from "./cssmaps/interactivity";

// Transform utilities
import {
  origin,
  transform,
  translate,
  translateX,
  translateY,
  translateZ,
  perspective,
  perspectiveOrigin,
  backface,
} from "./cssmaps/transforms";

// Typography extended utilities
import { word } from "./cssmaps/typography-extended";

// Effects utilities
import { backdrop, dropShadow } from "./cssmaps/effects";
import { mixBlend } from "./cssmaps/mix-blend";

// SVG utilities
import { fill, stroke, strokeWidth } from "./cssmaps/svg";

// Scroll utilities
import {
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
  snap,
  scrollMe,
  scrollMs,
  scrollPs,
  scrollPe,
  scroll,
} from "./cssmaps/scroll";

// Miscellaneous utilities
import {
  writingMode,
  breakInside,
  breakBefore,
  breakAfter,
  size,
  placeholder,
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
import { divide, divideX, divideY } from "./cssmaps/divide";
import { flex } from "./cssmaps/flex";
import { gridCols } from "./cssmaps/grid-cols";
import { gap, gapX, gapY } from "./cssmaps/gap";
import { scale, scaleX, scaleY, scaleZ, scale3d } from "./cssmaps/scale";
import { rotateX, rotateY, rotateZ } from "./cssmaps/rotate";
import { skew, skewX, skewY } from "./cssmaps/skew";
import { touch } from "./cssmaps/touch";
import { select } from "./cssmaps/select";
import { willChange } from "./cssmaps/willChange";
import { resize } from "./cssmaps/resize";
import { cursor } from "./cssmaps/cursor";
import { colorScheme, forcedColorAdjust } from "./cssmaps/color-scheme";
import { caret } from "./cssmaps/caret";
import { accent } from "./cssmaps/accent";
import {
  borderSpacing,
  borderSpacingX,
  borderSpacingY,
} from "./cssmaps/border-spacing";
import {
  blur,
  brightness,
  contrast,
  filter,
  grayscale,
  hueRotate,
  invert,
  saturate,
  sepia,
} from "./cssmaps/filter";
import {
  backdropBlur,
  backdropBrightness,
  backdropContrast,
  backdropFilter,
  backdropGrayscale,
  backdropHueRotate,
  backdropInvert,
  backdropSaturate,
  backdropSepia,
} from "./cssmaps/backdrop-filter";
import {
  mask,
  maskClip,
  maskOrigin,
  maskPosition,
  maskRepeat,
  maskSize,
  maskType,
} from "./cssmaps/mask";

type CssmaCssValue = string | { [key: string]: string | undefined } | undefined;

export const utilityToCss: Record<
  string,
  (
    utility: ParsedClassToken,
    context: CssmaContext
  ) => Record<string, CssmaCssValue> | undefined
> = {
  bg: bg, // done
  "bg-none": bg, // done
  "bg-blend": bgBlend, // done
  "bg-clip": bgClip, // done
  "bg-origin": bgOrigin, // done
  "bg-repeat": bgRepeat, // done
  "bg-no-repeat": bgNoRepeat, // done
  "bg-size": bgSize, // done
  "bg-position": bgPosition, // done
  "bg-fixed": bgFixed, // done
  "bg-local": bgLocal, // done
  "bg-scroll": bgScroll, // done
  "bg-linear": bgLinear, // done
  "bg-radial": bgRadial, // done
  "bg-conic": bgConic, // done
  from: from, // done
  via: via, // done
  to: to, // done

  m: m, // done
  mx: mx, // done
  my: my, // done
  mt: mt, // done
  mb: mb, // done
  ml: ml, // done
  mr: mr, // done
  p: p, // done
  px: px, // done
  py: py, // done
  pt: pt, // done
  pb: pb, // done
  pl: pl, // done
  pr: pr, // done
  border: border, // done
  "border-t": borderT, // done
  "border-b": borderB, // done
  "border-l": borderL, // done
  "border-r": borderR, // done
  "border-x": borderX, // done
  "border-y": borderY, // done
  "border-s": borderS, // done
  "border-e": borderE, // done
  "rounded-ss": roundedSs, // done
  "rounded-se": roundedSe, // done
  "rounded-es": roundedEs, // done
  "rounded-ee": roundedEe, // done
  "rounded-bl": roundedBl, // done
  "rounded-br": roundedBr, // done
  "rounded-tl": roundedTl, // done
  "rounded-tr": roundedTr, // done
  "rounded-b": roundedB, // done
  "rounded-l": roundedL, // done
  "rounded-r": roundedR, // done
  "rounded-t": roundedT, // done
  "rounded-s": roundedS, // done
  "rounded-e": roundedE, // done
  rounded: rounded, // done

  shadow: shadow, // done
  "inset-shadow": insetShadow, // done
  opacity: opacity, // done
  w: w, // done
  h: h, // done
  "min-w": minW, // done
  "max-w": maxW, // done
  "min-h": minH, // done
  "max-h": maxH, // done
  size: size, // done

  // font utilities
  italic: fontStyle, // done
  "not-italic": fontStyle, // done

  // Font smoothing keywords
  antialiased: fontSmoothing, // done
  "subpixel-antialiased": fontSmoothing, // done

  // Font variant numeric keywords
  "normal-nums": fontVariantNumeric, // done
  ordinal: fontVariantNumeric, // done
  "slashed-zero": fontVariantNumeric, // done
  "lining-nums": fontVariantNumeric, // done
  "oldstyle-nums": fontVariantNumeric, // done
  "proportional-nums": fontVariantNumeric, // done
  "tabular-nums": fontVariantNumeric, // done
  "diagonal-fractions": fontVariantNumeric, // done
  "stacked-fractions": fontVariantNumeric,

  // Font utilities with values
  font: font, // done
  align: verticalAlign, // done
  underline: textDecorationLine, // done
  overline: textDecorationLine, // done
  "line-through": textDecorationLine, // done
  "no-underline": textDecorationLine, // done
  decoration: textDecoration, // done
  "underline-offset": underlineOffset, // done

  // Text layout with values
  indent: textIndent, // done
  whitespace: whiteSpace, // done
  break: wordBreak, // done
  hyphens: hyphensNew, // done
  leading: lineHeight, // done
  tracking: letterSpacing, // done
  "line-clamp": lineClampNew, // done

  // Text effects utilities (new structure)
  uppercase: textTransform, // done
  lowercase: textTransform, // done
  capitalize: textTransform, // done
  "normal-case": textTransform, // done
  "text-shadow": textShadowNew, // done
  trancate: text, // done
  text: text, // done

  content: content, // done

  // List style utilities (new structure)
  list: list, // done
  "list-image": listStyleImage, // done

  flex: flex, // done
  "grid-cols": gridCols, // done
  gap: gap, // done
  "gap-x": gapX, // done
  "gap-y": gapY, // done
  justify: justify, // done, justify-content
  "justify-self": justifySelf, // done,
  "justify-items": justifyItems, // done
  "align-content": alignContent, // done
  items: alignItems, // done
  self: alignSelf, // done
  "place-content": placeContent, // done
  "place-items": placeItems, // done
  "place-self": placeSelf, // done
  "scale-3d": scale3d, // done
  "scale-x": scaleX, // done
  "scale-y": scaleY, // done
  "scale-z": scaleZ, // done
  scale: scale, // done

  "rotate-x": rotateX, // done
  "rotate-y": rotateY, // done
  "rotate-z": rotateZ, // done
  rotate: rotate, // done

  skew: skew, // done
  "skew-x": skewX, // done
  "skew-y": skewY, // done

  backface: backface, // done
  perspective: perspective, // done
  "perspective-origin": perspectiveOrigin, // done
  transform: transform, // done
  origin: origin, // done

  translate: translate, // done
  "translate-x": translateX, // done
  "translate-y": translateY, // done
  "translate-z": translateZ, // done

  "scroll-mx": scrollMx, // done
  "scroll-ms": scrollMs, // done
  "scroll-me": scrollMe, // done
  "scroll-my": scrollMy, // done
  "scroll-mt": scrollMt, // done
  "scroll-mb": scrollMb, // done
  "scroll-ml": scrollMl, // done
  "scroll-mr": scrollMr, // done
  "scroll-m": scrollM, // done

  "scroll-px": scrollPx, // done
  "scroll-py": scrollPy, // done
  "scroll-ps": scrollPs, // done
  "scroll-pe": scrollPe, // done
  "scroll-pt": scrollPt, // done
  "scroll-pb": scrollPb, // done
  "scroll-pl": scrollPl, // done
  "scroll-pr": scrollPr, // done
  "scroll-p": scrollP, // done

  snap: snap, // done

  touch: touch, // done

  select: select, // done

  "will-change": willChange, // done

  scroll: scroll, // done
  resize: resize, // done
  "pointer-events": pointerEvents, // done
  "field-sizing": fieldSizing, // done
  cursor: cursor, // done
  scheme: colorScheme, // done
  caret: caret, // done
  appearance: appearance, // done
  accent: accent, // done
  "forced-color-adjust": forcedColorAdjust, // done
  transition: transition, // done
  duration: duration, // done
  delay: delay, // done
  ease: ease, // done
  animate: animate, // done

  caption: captionSide, // done
  table: tableLayout, // done
  "border-spacing": borderSpacing, // done
  "border-spacing-x": borderSpacingX, // done
  "border-spacing-y": borderSpacingY, // done

  // border 에 대한 것을 하고 난 다음 처리
  // "border-collapse": borderCollapse, // done
  // "border-separate": borderSeparate, // done

  filter: filter, // done
  blur: blur, // done
  brightness: brightness, // done
  contrast: contrast, // done
  grayscale: grayscale, // done
  hueRotate: hueRotate, // done
  invert: invert, // done
  saturate: saturate, // done
  sepia: sepia, // done

  "backdrop-blur": backdropBlur, // done
  "backdrop-filter": backdropFilter, // done
  "backdrop-brightness": backdropBrightness, // done
  "backdrop-contrast": backdropContrast, // done
  "backdrop-grayscale": backdropGrayscale, // done
  "backdrop-hue-rotate": backdropHueRotate, // done
  "backdrop-invert": backdropInvert, // done
  "backdrop-saturate": backdropSaturate, // done
  "backdrop-sepia": backdropSepia, // done

  mask: mask, // done
  "mask-clip": maskClip, // done
  "mask-origin": maskOrigin, // done
  "mask-repeat": maskRepeat, // done
  "mask-size": maskSize, // done
  "mask-position": maskPosition, // done
  "mask-type": maskType, // done
  // TODO: mask-image 처리 필요
  // "mask-image": maskImage, // done

  "mix-blend": mixBlend, // done

  "outline-offset": outlineOffset, // done
  outline: outline, // done

  "divide-x": divideX, // done
  "divide-y": divideY, // done
  divide: divide, // done
  aspect: aspect,

  "writing-mode": writingMode,
  float: float,
  clear: clear,
  overflow: overflow,
  "overflow-x": overflowX,
  "overflow-y": overflowY,

  isolation: isolation,


  backdrop: backdrop,
  z: z,
  order: order,
  inset: inset,
  top: top,
  left: left,
  right: right,
  bottom: bottom,
  object: object,
  ring: ring,

  box: box,
  "box-decoration": boxDecoration,
  "drop-shadow": dropShadow,
  "break-inside": breakInside,
  "break-before": breakBefore,
  "break-after": breakAfter,

  fill: fill,

  visible: visible,
  invisible: invisible,
  collapse: collapse,
  display: display,
  container: container,
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

  stroke: stroke,
  "stroke-width": strokeWidth,
  "bg-gradient": bgGradient,
  "bg-gradient-to": bgGradientTo,

  gradient: gradient,
  word: word,
};
