# background-image

Utilities for controlling an element's background image.

## Quick reference

| Class | Styles |
|---|---|
| `bg-[&lt;value&gt;]` | `background-image: &lt;value&gt;;` |
| `bg-(image:&lt;custom-property&gt;)` | `background-image: var(&lt;custom-property&gt;);` |
| `bg-none` | `background-image: none;` |
| `bg-linear-to-t` | `background-image: linear-gradient(to top, var(--baro-gradient-stops));` |
| `bg-linear-to-tr` | `background-image: linear-gradient(to top right, var(--baro-gradient-stops));` |
| `bg-linear-to-r` | `background-image: linear-gradient(to right, var(--baro-gradient-stops));` |
| `bg-linear-to-br` | `background-image: linear-gradient(to bottom right, var(--baro-gradient-stops));` |
| `bg-linear-to-b` | `background-image: linear-gradient(to bottom, var(--baro-gradient-stops));` |
| `bg-linear-to-bl` | `background-image: linear-gradient(to bottom left, var(--baro-gradient-stops));` |
| `bg-linear-to-l` | `background-image: linear-gradient(to left, var(--baro-gradient-stops));` |
| `bg-linear-to-tl` | `background-image: linear-gradient(to top left, var(--baro-gradient-stops));` |
| `bg-linear-<angle>` | `background-image: linear-gradient(<angle> in oklab, var(--baro-gradient-stops));` |
| `-bg-linear-<angle>` | `background-image: linear-gradient(-<angle> in oklab, var(--baro-gradient-stops));` |
| `bg-linear-(&lt;custom-property&gt;)` | `background-image: linear-gradient(var(--baro-gradient-stops, var(&lt;custom-property&gt;)));` |
| `bg-linear-[&lt;value&gt;]` | `background-image: linear-gradient(var(--baro-gradient-stops, &lt;value&gt;));` |
| `bg-radial` | `background-image: radial-gradient(in oklab, var(--baro-gradient-stops));` |
| `bg-radial-(&lt;custom-property&gt;)` | `background-image: radial-gradient(var(--baro-gradient-stops,  var(&lt;custom-property&gt;)));` |
| `bg-radial-[&lt;value&gt;]` | `background-image: radial-gradient(var(--baro-gradient-stops, &lt;value&gt;));` |
| `bg-conic-<angle>` | `background-image: conic-gradient(from <angle> in oklab, var(--baro-gradient-stops));` |
| `-bg-conic-<angle>` | `background-image: conic-gradient(from -<angle> in oklab, var(--baro-gradient-stops));` |
| `bg-conic-(&lt;custom-property&gt;)` | `background-image: var(&lt;custom-property&gt;);` |
| `bg-conic-[&lt;value&gt;]` | `background-image: <image>;` |
| `from-&lt;color&gt;` | `--baro-gradient-from: &lt;color&gt;;` |
| `from-<percentage>` | `--baro-gradient-from-position: <percentage>;` |
| `from-(&lt;custom-property&gt;)` | `--baro-gradient-from: var(&lt;custom-property&gt;);` |
| `from-[&lt;value&gt;]` | `--baro-gradient-from: &lt;value&gt;;` |
| `via-&lt;color&gt;` | `--baro-gradient-via: &lt;color&gt;;` |
| `via-<percentage>` | `--baro-gradient-via-position: <percentage>;` |
| `via-(&lt;custom-property&gt;)` | `--baro-gradient-via: var(&lt;custom-property&gt;);` |
| `via-[&lt;value&gt;]` | `--baro-gradient-via: &lt;value&gt;;` |
| `to-&lt;color&gt;` | `--baro-gradient-to: &lt;color&gt;;` |
| `to-<percentage>` | `--baro-gradient-to-position: <percentage>;` |
| `to-(&lt;custom-property&gt;)` | `--baro-gradient-to: var(&lt;custom-property&gt;);` |
| `to-[&lt;value&gt;]` | `--baro-gradient-to: &lt;value&gt;;` |



## Examples

### Basic example

Use the `bg-[&lt;value&gt;]` syntax to set the background image of an element:

```html
<!-- [!code classes:bg-[url(/img/mountains.jpg)]] -->
<div class="bg-[url(/img/mountains.jpg)] ..."></div>
```

### Adding a linear gradient

Use utilities like `bg-linear-to-r` and `bg-linear-<angle>` with the color stop utilities to add a linear gradient to an element:

```html
<!-- [!code classes:bg-linear-to-r,bg-linear-to-t,bg-linear-to-bl,bg-linear-65] -->
<div class="h-14 rounded-lg bg-linear-to-r from-cyan-500 to-blue-500"></div>
<div class="h-14 rounded-lg bg-linear-to-t from-sky-500 to-indigo-500"></div>
<div class="h-14 rounded-lg bg-linear-to-bl from-violet-500 to-fuchsia-500"></div>
<div class="h-14 rounded-lg bg-linear-65 from-purple-500 to-pink-500"></div>
```

### Adding a radial gradient

Use the `bg-radial` and `bg-radial-[<position>]` utilities with the color stop utilities to add a radial gradient to an element:

```html
<!-- [!code classes:bg-radial-[at_50%_75%],bg-radial-[at_25%_25%],bg-radial] -->
<div class="size-18 rounded-full bg-radial from-pink-400 from-40% to-fuchsia-700"></div>
<div class="size-18 rounded-full bg-radial-[at_50%_75%] from-sky-200 via-blue-400 to-indigo-900 to-90%"></div>
<div class="size-18 rounded-full bg-radial-[at_25%_25%] from-white to-zinc-900 to-75%"></div>
```

### Adding a conic gradient

Use the `bg-conic` and `bg-conic-<angle>` utilities with the color stop utilities to add a conic gradient to an element:

```html
<!-- [!code classes:bg-conic-180,bg-conic/decreasing,bg-conic] -->
<div class="size-24 rounded-full bg-conic from-blue-600 to-sky-400 to-50%"></div>
<div class="size-24 rounded-full bg-conic-180 from-indigo-600 via-indigo-50 to-indigo-600"></div>
<div class="size-24 rounded-full bg-conic/decreasing from-violet-700 via-lime-300 to-violet-700"></div>
```

### Setting gradient color stops

Use utilities like `from-indigo-500`, `via-purple-500`, and `to-pink-500` to set the colors of the gradient stops:

```html
<!-- [!code classes:from-indigo-500,via-purple-500,to-pink-500] -->
<div class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 ..."></div>
```

### Setting gradient stop positions

Use utilities like `from-10%`, `via-30%`, and `to-90%` to set more precise positions for the gradient color stops:

```html
<!-- [!code classes:from-10%,via-30%,to-90%] -->
<div class="bg-gradient-to-r from-indigo-500 from-10% via-sky-500 via-30% to-emerald-500 to-90% ..."></div>
```

### Changing interpolation mode

Use the interpolation modifier to control the interpolation mode of a gradient:

```html
<!-- [!code word:/srgb] -->
<!-- [!code word:/hsl] -->
<!-- [!code word:/oklab] -->
<!-- [!code word:/oklch] -->
<!-- [!code word:/longer] -->
<!-- [!code word:/shorter] -->
<!-- [!code word:/increasing] -->
<!-- [!code word:/decreasing] -->
<div class="bg-linear-to-r/srgb from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/hsl from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/oklab from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/oklch from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/longer from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/shorter from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/increasing from-indigo-500 to-teal-400"></div>
<div class="bg-linear-to-r/decreasing from-indigo-500 to-teal-400"></div>
```

By default gradients are interpolated in the `oklab` color space.

### Removing background images

Use the `bg-none` utility to remove an existing background image from an element:

```html
<!-- [!code classes:bg-none] -->
<div class="bg-none"></div>
```

### Using a custom value

Use the `bg-[&lt;value&gt;]` syntax to set the background image based on a completely custom value:

```html
<div class="bg-[url('/path/to/image.jpg')] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `bg-(image:&lt;custom-property&gt;)` syntax:

```html
<div class="bg-(image:--my-image) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `bg-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `background-image` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="from-purple-400 md:from-yellow-500 ...">
  <!-- ... -->
</div>
```


## Customizing your theme

Use your theme colors with the gradient stop utilities `from`, `via`, and `to`. You can also use arbitrary values with `bg-[&lt;value&gt;]`, angle variants with `bg-linear-<angle>`, and position variants for stops like `from-10%`.

For example, to add a custom gradient to your theme:

```css
```

Then use it in your HTML:

```html
<div class="bg-[var(--gradient-custom)]">
  <!-- ... -->
</div>
```


