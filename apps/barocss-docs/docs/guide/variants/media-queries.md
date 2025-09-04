# Media and feature queries

## Responsive breakpoints

Use responsive variants to apply different styles at different screen sizes:

```html
<div class="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/6">
  Responsive width
</div>
```

## prefers-color-scheme

Use the `dark` variant to apply styles in dark mode:

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  This div has different colors in light and dark mode.
</div>
```

## prefers-reduced-motion

Use the `motion-reduce` variant to respect user preferences for reduced motion:

```html
<div class="transition-transform duration-300 hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100">
  This element respects reduced motion preferences.
</div>
```

## prefers-contrast

Use the `contrast-more` and `contrast-less` variants to apply styles based on contrast preferences:

```html
<button class="bg-blue-500 text-white contrast-more:bg-blue-700 contrast-more:border-2 contrast-more:border-white contrast-less:bg-blue-400">
  High contrast button
</button>
```

## forced-colors

Use the `forced-colors` variant to apply styles when forced colors are active:

```html
<div class="bg-blue-500 text-white forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]">
  This div adapts to forced colors mode.
</div>
```

## inverted-colors

Use the `inverted-colors` variant to apply styles when inverted colors are active:

```html
<div class="bg-blue-500 text-white inverted-colors:bg-yellow-500 inverted-colors:text-black">
  This div adapts to inverted colors mode.
</div>
```

## pointer and any-pointer

Use the `pointer-coarse` and `pointer-fine` variants to apply styles based on pointer type:

```html
<button class="bg-blue-500 text-white pointer-coarse:bg-green-500 pointer-fine:bg-red-500">
  This button changes color based on pointer type.
</button>
```

## orientation

Use the `portrait` and `landscape` variants to apply styles based on orientation:

```html
<div class="bg-blue-500 text-white portrait:bg-green-500 landscape:bg-red-500">
  This div changes color based on orientation.
</div>
```

## scripting

Use the `scripting` variant to apply styles when JavaScript is available:

```html
<div class="bg-blue-500 text-white scripting:bg-green-500">
  This div changes color when JavaScript is available.
</div>
```

## print

Use the `print` variant to apply styles when printing:

```html
<div class="bg-white print:bg-transparent print:text-black">
  This div has different styles when printed.
</div>
```

## @supports

Use the `supports-*` variants to apply styles based on CSS feature support:

```html
<div class="bg-blue-500 text-white supports-[display:grid]:bg-green-500">
  This div changes color when CSS Grid is supported.
</div>
```

## @starting-style

Use the `starting-style` variant to apply styles at the start of a transition:

```html
<div class="bg-blue-500 text-white starting-style:bg-green-500">
  This div changes color at the start of a transition.
</div>
```

## Media query reference

| Variant | CSS Media Query | Description |
|---------|-----------------|-------------|
| `sm` | `@media (min-width: 640px)` | Small screens and up |
| `md` | `@media (min-width: 768px)` | Medium screens and up |
| `lg` | `@media (min-width: 1024px)` | Large screens and up |
| `xl` | `@media (min-width: 1280px)` | Extra large screens and up |
| `2xl` | `@media (min-width: 1536px)` | 2X large screens and up |
| `dark` | `@media (prefers-color-scheme: dark)` | Dark mode |
| `motion-reduce` | `@media (prefers-reduced-motion: reduce)` | Reduced motion preference |
| `motion-safe` | `@media (prefers-reduced-motion: no-preference)` | Normal motion preference |
| `print` | `@media print` | Print media |
| `contrast-more` | `@media (prefers-contrast: more)` | High contrast mode |
| `contrast-less` | `@media (prefers-contrast: less)` | Low contrast mode |
| `forced-colors` | `@media (forced-colors: active)` | Forced colors mode |
