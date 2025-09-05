# rotate

Utilities for rotating elements.

Source: https://tailwindcss.com/guide/rotate

## Quick reference

| Class | Styles |
|---|---|
| rotate-none | rotate: none; |
| rotate-&lt;number&gt; | rotate: &lt;number&gt;deg; |
| -rotate-&lt;number&gt; | rotate: calc(&lt;number&gt;deg * -1); |
| rotate-(&lt;custom-property&gt;) | rotate: var(&lt;custom-property&gt;); |
| rotate-[&lt;value&gt;] | rotate: &lt;value&gt;; |
| rotate-x-&lt;number&gt; | transform: rotateX(&lt;number&gt;deg) var(--tw-rotate-y); |
| -rotate-x-&lt;number&gt; | transform: rotateX(-&lt;number&gt;deg) var(--tw-rotate-y); |
| rotate-x-(&lt;custom-property&gt;) | transform: rotateX(var(&lt;custom-property&gt;)) var(--tw-rotate-y); |
| rotate-x-[&lt;value&gt;] | transform: rotateX(&lt;value&gt;) var(--tw-rotate-y); |
| rotate-y-&lt;number&gt; | transform: var(--tw-rotate-x) rotateY(&lt;number&gt;deg); |
| -rotate-y-&lt;number&gt; | transform: var(--tw-rotate-x) rotateY(-&lt;number&gt;deg); |
| rotate-y-(&lt;custom-property&gt;) | transform: var(--tw-rotate-x) rotateY(var(&lt;custom-property&gt;)); |
| rotate-y-[&lt;value&gt;] | transform: var(--tw-rotate-x) rotateY(&lt;value&gt;); |
| rotate-z-&lt;number&gt; | transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(&lt;number&gt;deg); |
| -rotate-z-&lt;number&gt; | transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(-&lt;number&gt;deg); |
| rotate-z-(&lt;custom-property&gt;) | transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(var(&lt;custom-property&gt;)); |
| rotate-z-[&lt;value&gt;] | transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(&lt;value&gt;); |

## Examples

### Basic example

Use `rotate-&lt;number&gt;` utilities like `rotate-45` and `rotate-90` to rotate an element by degrees:

```html
<img class="rotate-45 ..." src="/img/mountains.jpg" />
<img class="rotate-90 ..." src="/img/mountains.jpg" />
<img class="rotate-210 ..." src="/img/mountains.jpg" />
```

### Using negative values

Use `-rotate-&lt;number&gt;` utilities like `-rotate-45` and `-rotate-90` to rotate an element counterclockwise by degrees:

```html
<img class="-rotate-45 ..." src="/img/mountains.jpg" />
<img class="-rotate-90 ..." src="/img/mountains.jpg" />
<img class="-rotate-210 ..." src="/img/mountains.jpg" />
```

### Rotating in 3D space

Use `rotate-x-&lt;number&gt;`, `rotate-y-&lt;number&gt;`, and `rotate-z-&lt;number&gt;` utilities like `rotate-x-50`, `-rotate-y-30`, and `rotate-z-45` together to rotate an element in 3D space:

```html
<img class="rotate-x-50 rotate-z-45 ..." src="/img/mountains.jpg" />
<img class="rotate-x-15 -rotate-y-30 ..." src="/img/mountains.jpg" />
<img class="rotate-y-25 rotate-z-30 ..." src="/img/mountains.jpg" />
```

### Using a custom value

Use the `rotate-[&lt;value&gt;]` syntax to set the rotation based on a completely custom value:

```html
<img class="rotate-[3.142rad] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `rotate-(&lt;custom-property&gt;)` syntax:

```html
<img class="rotate-(--my-rotation) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `rotate-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `rotate` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="rotate-45 md:rotate-60 ..." src="/img/mountains.jpg" />
```

Learn more about using variants in the variants documentation.
