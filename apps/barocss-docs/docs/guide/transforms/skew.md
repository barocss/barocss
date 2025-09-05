# skew

Utilities for skewing elements with transform.

Source: https://tailwindcss.com/guide/skew

## Quick reference

| Class | Styles |
|---|---|
| skew-&lt;number&gt; | transform: skewX(&lt;number&gt;deg) skewY(&lt;number&gt;deg); |
| -skew-&lt;number&gt; | transform: skewX(-&lt;number&gt;deg) skewY(-&lt;number&gt;deg); |
| skew-(&lt;custom-property&gt;) | transform: skewX(var(&lt;custom-property&gt;)) skewY(var(&lt;custom-property&gt;)); |
| skew-[&lt;value&gt;] | transform: skewX(&lt;value&gt;) skewY(&lt;value&gt;); |
| skew-x-&lt;number&gt; | transform: skewX(&lt;number&gt;deg); |
| -skew-x-&lt;number&gt; | transform: skewX(-&lt;number&gt;deg); |
| skew-x-(&lt;custom-property&gt;) | transform: skewX(var(&lt;custom-property&gt;)); |
| skew-x-[&lt;value&gt;] | transform: skewX(&lt;value&gt;); |
| skew-y-&lt;number&gt; | transform: skewY(&lt;number&gt;deg); |
| -skew-y-&lt;number&gt; | transform: skewY(-&lt;number&gt;deg); |
| skew-y-(&lt;custom-property&gt;) | transform: skewY(var(&lt;custom-property&gt;)); |
| skew-y-[&lt;value&gt;] | transform: skewY(&lt;value&gt;); |

## Examples

### Basic example

Use `skew-&lt;number&gt;` utilities like `skew-4` and `skew-10` to skew an element on both axes:

```html
<img class="skew-3 ..." src="/img/mountains.jpg" />
<img class="skew-6 ..." src="/img/mountains.jpg" />
<img class="skew-12 ..." src="/img/mountains.jpg" />
```

### Using negative values

Use `-skew-&lt;number&gt;` utilities like `-skew-4` and `-skew-10` to skew an element on both axes:

```html
<img class="-skew-3 ..." src="/img/mountains.jpg" />
<img class="-skew-6 ..." src="/img/mountains.jpg" />
<img class="-skew-12 ..." src="/img/mountains.jpg" />
```

### Skewing on the x-axis

Use `skew-x-&lt;number&gt;` utilities like `skew-x-4` and `-skew-x-10` to skew an element on the x-axis:

```html
<img class="-skew-x-12 ..." src="/img/mountains.jpg" />
<img class="skew-x-6 ..." src="/img/mountains.jpg" />
<img class="skew-x-12 ..." src="/img/mountains.jpg" />
```

### Skewing on the y-axis

Use `skew-y-&lt;number&gt;` utilities like `skew-y-4` and `-skew-y-10` to skew an element on the y-axis:

```html
<img class="-skew-y-12 ..." src="/img/mountains.jpg" />
<img class="skew-y-6 ..." src="/img/mountains.jpg" />
<img class="skew-y-12 ..." src="/img/mountains.jpg" />
```

### Using a custom value

Use the `skew-[&lt;value&gt;]` syntax to set the skew based on a completely custom value:

```html
<img class="skew-[3.142rad] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `skew-(&lt;custom-property&gt;)` syntax:

```html
<img class="skew-(--my-skew) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `skew-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `skew` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="skew-3 md:skew-12 ..." src="/img/mountains.jpg" />
```

Learn more about using variants in the variants documentation.
