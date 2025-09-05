# animation

Utilities for animating elements with CSS animations.

## Quick reference

| Class | Styles |
|---|---|
| `animate-spin` | `animation: var(--animate-spin); /* spin 1s linear infinite */ @keyframes spin { to { transform: rotate(360deg); } }` |
| `animate-ping` | `animation: var(--animate-ping); /* ping 1s cubic-bezier(0, 0, 0.2, 1) infinite */ @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }` |
| `animate-pulse` | `animation: var(--animate-pulse); /* pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite */ @keyframes pulse { 50% { opacity: 0.5; } }` |
| `animate-bounce` | `animation: var(--animate-bounce); /* bounce 1s infinite */ @keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); } 50% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); } }` |
| `animate-none` | `animation: none;` |
| `animate-(&lt;custom-property&gt;)` | `animation: var(&lt;custom-property&gt;);` |
| `animate-[&lt;value&gt;]` | `animation: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/animation

## Examples

### Adding a spin animation

Use the `animate-spin` utility to add a linear spin animation to elements like loading indicators:

```html
<!-- [!code classes:animate-spin] -->
<button type="button" class="bg-indigo-500 ..." disabled>
  <svg class="mr-3 size-5 animate-spin ..." viewBox="0 0 24 24">
    <!-- ... -->
  </svg>
  Processing…
</button>
```

### Adding a ping animation

Use the `animate-ping` utility to make an element scale and fade like a radar ping or ripple of water—useful for things like notification badges:

```html
<!-- [!code classes:animate-ping] -->
<span class="relative flex size-3">
  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
  <span class="relative inline-flex size-3 rounded-full bg-sky-500"></span>
</span>
```

### Adding a pulse animation

Use the `animate-pulse` utility to make an element gently fade in and out—useful for things like skeleton loaders:

```html
<!-- [!code classes:animate-pulse] -->
<div class="mx-auto w-full max-w-sm rounded-md border border-blue-300 p-4">
  <div class="flex animate-pulse space-x-4">
    <div class="size-10 rounded-full bg-gray-200"></div>
    <div class="flex-1 space-y-6 py-1">
      <div class="h-2 rounded bg-gray-200"></div>
      <div class="space-y-3">
        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2 h-2 rounded bg-gray-200"></div>
          <div class="col-span-1 h-2 rounded bg-gray-200"></div>
        </div>
        <div class="h-2 rounded bg-gray-200"></div>
      </div>
    </div>
  </div>
</div>
```

### Adding a bounce animation

Use the `animate-bounce` utility to make an element bounce up and down—useful for things like "scroll down" indicators:

```html
<!-- [!code classes:animate-bounce] -->
<svg class="size-6 animate-bounce ...">
  <!-- ... -->
</svg>
```

### Supporting reduced motion

For situations where the user has specified that they prefer reduced motion, you can conditionally apply animations and transitions using the `motion-safe` and `motion-reduce` variants:

```html
<!-- [!code classes:motion-safe:animate-spin] -->
<button type="button" class="bg-indigo-600 ..." disabled>
  <svg class="mr-3 size-5 motion-safe:animate-spin ..." viewBox="0 0 24 24">
    <!-- ... -->
  </svg>
  Processing
</button>
```

### Using a custom value

```html
<div class="[animation:wiggle_1s_ease-in-out_infinite] ..."></div>
```

### Responsive design

```html
<div class="animate-none md:animate-spin ..."></div>
```

## Customizing your theme

Use your design tokens to populate `--animate-*` variables and reference them with `animate-{name}` (for example, `animate-spin`). You can also use arbitrary values with `animate-[&lt;value&gt;]` and custom properties with `animate-(&lt;custom-property&gt;)`.
