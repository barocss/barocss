import { isLengthValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// appearance
export const appearance = (utility: ParsedClassToken) => ({ appearance: utility.value + (utility.important ? ' !important' : '') });
// writing-mode
export const writingMode = (utility: ParsedClassToken) => ({ writingMode: utility.value + (utility.important ? ' !important' : '') });
// user-select
export const userSelect = (utility: ParsedClassToken) => ({ userSelect: utility.value + (utility.important ? ' !important' : '') });
// float
export const float = (utility: ParsedClassToken) => ({ float: utility.value + (utility.important ? ' !important' : '') });
// clear
export const clear = (utility: ParsedClassToken) => ({ clear: utility.value + (utility.important ? ' !important' : '') });
// overflow
export const overflow = (utility: ParsedClassToken) => ({ overflow: utility.value + (utility.important ? ' !important' : '') });
export const overflowX = (utility: ParsedClassToken) => ({ overflowX: utility.value + (utility.important ? ' !important' : '') });
export const overflowY = (utility: ParsedClassToken) => ({ overflowY: utility.value + (utility.important ? ' !important' : '') });
// truncate
export const truncate = () => ({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
// line-clamp
export const lineClamp = (utility: ParsedClassToken) => ({ WebkitLineClamp: utility.value + (utility.important ? ' !important' : '') });
// pointer-events
export const pointerEvents = (utility: ParsedClassToken) => ({ pointerEvents: utility.value + (utility.important ? ' !important' : '') });
// select
export const select = (utility: ParsedClassToken) => ({ select: utility.value + (utility.important ? ' !important' : '') });
// resize
export const resize = (utility: ParsedClassToken) => ({ resize: utility.value + (utility.important ? ' !important' : '') });
// isolation
export const isolation = (utility: ParsedClassToken) => ({ isolation: utility.value + (utility.important ? ' !important' : '') });
// mix-blend-mode
export const mixBlend = (utility: ParsedClassToken) => ({ mixBlendMode: utility.value + (utility.important ? ' !important' : '') });
// filter
export const filter = (utility: ParsedClassToken) => ({ filter: utility.value + (utility.important ? ' !important' : '') });
// backdrop-filter
export const backdrop = (utility: ParsedClassToken) => ({ backdropFilter: utility.value + (utility.important ? ' !important' : '') });
// content
export const content = (utility: ParsedClassToken) => ({ content: utility.value + (utility.important ? ' !important' : '') });
// z-index
export const z = (utility: ParsedClassToken) => ({ zIndex: utility.value + (utility.important ? ' !important' : '') });
// order
export const order = (utility: ParsedClassToken) => ({ order: utility.value + (utility.important ? ' !important' : '') });
// place-content
export const placeContent = (utility: ParsedClassToken) => ({ placeContent: utility.value + (utility.important ? ' !important' : '') });
// place-items
export const placeItems = (utility: ParsedClassToken) => ({ placeItems: utility.value + (utility.important ? ' !important' : '') });
// place-self
export const placeSelf = (utility: ParsedClassToken) => ({ placeSelf: utility.value + (utility.important ? ' !important' : '') });
// align-content
export const alignContent = (utility: ParsedClassToken) => ({ alignContent: utility.value + (utility.important ? ' !important' : '') });
// align-items
export const alignItems = (utility: ParsedClassToken) => ({ alignItems: utility.value + (utility.important ? ' !important' : '') });
// align-self
export const alignSelf = (utility: ParsedClassToken) => ({ alignSelf: utility.value + (utility.important ? ' !important' : '') });
// justify-items
export const justifyItems = (utility: ParsedClassToken) => ({ justifyItems: utility.value + (utility.important ? ' !important' : '') });
// justify-self
export const justifySelf = (utility: ParsedClassToken) => ({ justifySelf: utility.value + (utility.important ? ' !important' : '') });
// inset
export const inset = (utility: ParsedClassToken) => ({ inset: utility.value + (utility.important ? ' !important' : '') });
// top
export const top = (utility: ParsedClassToken) => ({ top: utility.value + (utility.important ? ' !important' : '') });
// left
export const left = (utility: ParsedClassToken) => ({ left: utility.value + (utility.important ? ' !important' : '') });
// right
export const right = (utility: ParsedClassToken) => ({ right: utility.value + (utility.important ? ' !important' : '') });
// bottom
export const bottom = (utility: ParsedClassToken) => ({ bottom: utility.value + (utility.important ? ' !important' : '') });
// box
export const box = (utility: ParsedClassToken) => ({ boxSizing: utility.value });
// box-decoration
export const boxDecoration = (utility: ParsedClassToken) => ({ boxDecorationBreak: utility.value });
// border-collapse
export const borderCollapse = (utility: ParsedClassToken) => ({ borderCollapse: utility.value });
// border-separate
export const borderSeparate = (utility: ParsedClassToken) => ({ borderCollapse: utility.value });
// drop-shadow
export const dropShadow = (utility: ParsedClassToken) => ({ filter: `drop-shadow(${utility.value})` });
// break-inside
export const breakInside = (utility: ParsedClassToken) => ({ breakInside: utility.value });
// break-before
export const breakBefore = (utility: ParsedClassToken) => ({ breakBefore: utility.value });
// break-after
export const breakAfter = (utility: ParsedClassToken) => ({ breakAfter: utility.value });
// decoration
export const decoration = (utility: ParsedClassToken) => ({ textDecoration: utility.value });
// outline
export const outline = (utility: ParsedClassToken) => ({ outline: utility.value });
// accent
export const accent = (utility: ParsedClassToken) => ({ accentColor: utility.value });
// caret
export const caret = (utility: ParsedClassToken) => ({ caretColor: utility.value });
// fill
export const fill = (utility: ParsedClassToken) => ({ fill: utility.value });
// scheme
export const scheme = (utility: ParsedClassToken) => ({ colorScheme: utility.value });
// visible
export const visible = () => ({ visibility: 'visible' });
// invisible
export const invisible = () => ({ visibility: 'hidden' });
// collapse
export const collapse = () => ({ visibility: 'collapse' });
// whitespace
export const whitespace = (utility: ParsedClassToken) => ({ whiteSpace: utility.value });
// display
export const display = (utility: ParsedClassToken) => ({ display: utility.value });
// container
export const container = () => ({ containerType: 'inline-size' });
// cursor
export const cursor = (utility: ParsedClassToken) => ({ cursor: utility.value });
// placeholder
export const placeholder = (utility: ParsedClassToken) => ({ color: utility.value });
// static
export const static_ = () => ({ position: 'static' });
// fixed
export const fixed = () => ({ position: 'fixed' });
// absolute
export const absolute = () => ({ position: 'absolute' });
// relative
export const relative = () => ({ position: 'relative' });
// sticky
export const sticky = () => ({ position: 'sticky' });
// sub
export const sub = () => ({ verticalAlign: 'sub' });
// sup
export const sup = () => ({ verticalAlign: 'super' });
// sr-only
export const srOnly = () => ({ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: '0' });
// not-sr-only
export const notSrOnly = () => ({ position: 'static', width: 'auto', height: 'auto', padding: '0', margin: '0', overflow: 'visible', clip: 'auto', whiteSpace: 'normal', borderWidth: 'medium' });
// hyphens
export const hyphens = (utility: ParsedClassToken) => ({ hyphens: utility.value });
// list
export const list = (utility: ParsedClassToken) => ({ listStyle: utility.value });
// list-style-type
export const listStyleType = (utility: ParsedClassToken) => ({ listStyleType: utility.value });
// outline-width
export const outlineWidth = (utility: ParsedClassToken) => ({ outlineWidth: utility.value });
// outline-style
export const outlineStyle = (utility: ParsedClassToken) => ({ outlineStyle: utility.value });
// outline-offset
export const outlineOffset = (utility: ParsedClassToken) => ({ outlineOffset: utility.value });
// mask-type
export const maskType = (utility: ParsedClassToken) => ({ maskType: utility.value });
// mask-size
export const maskSize = (utility: ParsedClassToken) => ({ maskSize: utility.value });
// mask-repeat
export const maskRepeat = (utility: ParsedClassToken) => ({ maskRepeat: utility.value });
// mask-position
export const maskPosition = (utility: ParsedClassToken) => ({ maskPosition: utility.value });
// mask-mode
export const maskMode = (utility: ParsedClassToken) => ({ maskMode: utility.value });
// overscroll
export const overscroll = (utility: ParsedClassToken) => ({ overscrollBehavior: utility.value });
// overscroll-x
export const overscrollX = (utility: ParsedClassToken) => ({ overscrollBehaviorX: utility.value });
// overscroll-y
export const overscrollY = (utility: ParsedClassToken) => ({ overscrollBehaviorY: utility.value });
// scroll
export const scroll = (utility: ParsedClassToken) => ({ scrollBehavior: utility.value });
// scroll-mx
export const scrollMx = (utility: ParsedClassToken) => ({ scrollMarginLeft: utility.value, scrollMarginRight: utility.value });
// scroll-my
export const scrollMy = (utility: ParsedClassToken) => ({ scrollMarginTop: utility.value, scrollMarginBottom: utility.value });
// scroll-mt
export const scrollMt = (utility: ParsedClassToken) => ({ scrollMarginTop: utility.value });
// scroll-mb
export const scrollMb = (utility: ParsedClassToken) => ({ scrollMarginBottom: utility.value });
// scroll-ml
export const scrollMl = (utility: ParsedClassToken) => ({ scrollMarginLeft: utility.value });
// scroll-mr
export const scrollMr = (utility: ParsedClassToken) => ({ scrollMarginRight: utility.value });
// scroll-m
export const scrollM = (utility: ParsedClassToken) => ({ scrollMargin: utility.value });
// scroll-px
export const scrollPx = (utility: ParsedClassToken) => ({ scrollPaddingLeft: utility.value, scrollPaddingRight: utility.value });
// scroll-py
export const scrollPy = (utility: ParsedClassToken) => ({ scrollPaddingTop: utility.value, scrollPaddingBottom: utility.value });
// scroll-pt
export const scrollPt = (utility: ParsedClassToken) => ({ scrollPaddingTop: utility.value });
// scroll-pb
export const scrollPb = (utility: ParsedClassToken) => ({ scrollPaddingBottom: utility.value });
// scroll-pl
export const scrollPl = (utility: ParsedClassToken) => ({ scrollPaddingLeft: utility.value });
// scroll-pr
export const scrollPr = (utility: ParsedClassToken) => ({ scrollPaddingRight: utility.value });
// scroll-p
export const scrollP = (utility: ParsedClassToken) => ({ scrollPadding: utility.value });
// scroll-padding
export const scrollPadding = (utility: ParsedClassToken) => ({ scrollPadding: utility.value });
// scroll-margin
export const scrollMargin = (utility: ParsedClassToken) => ({ scrollMargin: utility.value });
// snap
export const snap = (utility: ParsedClassToken) => ({ scrollSnapType: utility.value });
// snap-x
export const snapX = (utility: ParsedClassToken) => ({ scrollSnapType: `x ${utility.value}` });
// snap-y
export const snapY = (utility: ParsedClassToken) => ({ scrollSnapType: `y ${utility.value}` });
// snap-align
export const snapAlign = (utility: ParsedClassToken) => ({ scrollSnapAlign: utility.value });
// origin
export const origin = (utility: ParsedClassToken) => ({ transformOrigin: utility.value });
// transform
export const transform = (utility: ParsedClassToken) => ({ transform: utility.value });
// transform-origin
export const transformOrigin = (utility: ParsedClassToken) => ({ transformOrigin: utility.value });
// transform-style
export const transformStyle = (utility: ParsedClassToken) => ({ transformStyle: utility.value });
// translate
export const translate = (utility: ParsedClassToken) => ({ transform: `translate(${utility.value})` });
// translate-x
export const translateX = (utility: ParsedClassToken) => ({ transform: `translateX(${utility.value})` });
// translate-y
export const translateY = (utility: ParsedClassToken) => ({ transform: `translateY(${utility.value})` });
// translate-z
export const translateZ = (utility: ParsedClassToken) => ({ transform: `translateZ(${utility.value})` });
// skew
export const skew = (utility: ParsedClassToken) => ({ transform: `skew(${utility.value})` });
// skew-x
export const skewX = (utility: ParsedClassToken) => ({ transform: `skewX(${utility.value})` });
// skew-y
export const skewY = (utility: ParsedClassToken) => ({ transform: `skewY(${utility.value})` });
// scale-x
export const scaleX = (utility: ParsedClassToken) => ({ transform: `scaleX(${utility.value})` });
// scale-y
export const scaleY = (utility: ParsedClassToken) => ({ transform: `scaleY(${utility.value})` });
// scale-z
export const scaleZ = (utility: ParsedClassToken) => ({ transform: `scaleZ(${utility.value})` });
// rotate-x
export const rotateX = (utility: ParsedClassToken) => ({ transform: `rotateX(${utility.value})` });
// rotate-y
export const rotateY = (utility: ParsedClassToken) => ({ transform: `rotateY(${utility.value})` });
// rotate-z
export const rotateZ = (utility: ParsedClassToken) => ({ transform: `rotateZ(${utility.value})` });
// perspective
export const perspective = (utility: ParsedClassToken) => ({ perspective: utility.value });
// perspective-origin
export const perspectiveOrigin = (utility: ParsedClassToken) => ({ perspectiveOrigin: utility.value });
// backface-hidden
export const backfaceHidden = () => ({ backfaceVisibility: 'hidden' });
// backface-visible
export const backfaceVisible = () => ({ backfaceVisibility: 'visible' });
// backface-visibility
export const backfaceVisibility = (utility: ParsedClassToken) => ({ backfaceVisibility: utility.value });
// field-sizing
export const fieldSizing = (utility: ParsedClassToken) => ({ fieldSizing: utility.value });
// field-sizing-fixed
export const fieldSizingFixed = () => ({ fieldSizing: 'fixed' });
// field-sizing-content
export const fieldSizingContent = () => ({ fieldSizing: 'content' });
// size
export const size = (utility: ParsedClassToken) => ({ size: utility.value });
// stroke
export const stroke = (utility: ParsedClassToken) => ({ stroke: utility.value });
// stroke-width
export const strokeWidth = (utility: ParsedClassToken) => ({ strokeWidth: utility.value });
// bg-gradient
export const bgGradient = (utility: ParsedClassToken) => ({ backgroundImage: utility.value });
// bg-gradient-to
export const bgGradientTo = (utility: ParsedClassToken) => ({ backgroundImage: utility.value });
// Tailwind v4 gradient stop utilities
export const from = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-from': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-from': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-from-position': utility.value };
  }
  return { '--tw-gradient-from': utility.value };
};
export const via = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-via': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-via': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-via-position': utility.value };
  }
  return { '--tw-gradient-via': utility.value };
};
export const to = (utility: ParsedClassToken) => {
  if (!utility.value) return undefined;
  if (utility.customProperty) {
    return { '--tw-gradient-to': `var(${utility.value})` };
  }
  if (utility.arbitrary && utility.arbitraryValue) {
    return { '--tw-gradient-to': utility.arbitraryValue };
  }
  if (isLengthValue(utility.value)) {
    return { '--tw-gradient-to-position': utility.value };
  }
  return { '--tw-gradient-to': utility.value };
};
// gradient
export const gradient = (utility: ParsedClassToken) => ({ gradient: utility.value });
// indent
export const indent = (utility: ParsedClassToken) => ({ textIndent: utility.value });
// overflow-wrap
export const overflowWrap = (utility: ParsedClassToken) => ({ overflowWrap: utility.value });
// break
export const break_ = (utility: ParsedClassToken) => ({ wordBreak: utility.value });
// word
export const word = (utility: ParsedClassToken) => ({ wordBreak: utility.value });
// text-shadow
export const textShadow = (utility: ParsedClassToken) => ({ textShadow: utility.value });
// underline
export const underline = () => ({ textDecoration: 'underline' });
// underline-offset
export const underlineOffset = (utility: ParsedClassToken) => ({ textUnderlineOffset: utility.value });
// overline
export const overline = () => ({ textDecoration: 'overline' });
// line-through
export const lineThrough = () => ({ textDecoration: 'line-through' });
// no-underline
export const noUnderline = () => ({ textDecoration: 'none' });
// normal-case
export const normalCase = () => ({ textTransform: 'none' });
// text-ellipsis
export const textEllipsis = () => ({ textOverflow: 'ellipsis' });
// text-clip
export const textClip = () => ({ textOverflow: 'clip' });
// uppercase
export const uppercase = () => ({ textTransform: 'uppercase' });
// lowercase
export const lowercase = () => ({ textTransform: 'lowercase' });
// capitalize
export const capitalize = () => ({ textTransform: 'capitalize' }); 