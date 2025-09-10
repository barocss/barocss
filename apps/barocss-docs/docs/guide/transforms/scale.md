# scale

Utilities for scaling elements.



## Quick reference

| Class | Styles |
|---|---|
| scale-none | scale: none; |
| scale-&lt;number&gt; | scale: &lt;number&gt;% &lt;number&gt;%; |
| -scale-&lt;number&gt; | scale: calc(&lt;number&gt;% * -1) calc(&lt;number&gt;% * -1); |
| scale-(&lt;custom-property&gt;) | scale: var(&lt;custom-property&gt;) var(&lt;custom-property&gt;); |
| scale-[&lt;value&gt;] | scale: &lt;value&gt;; |
| scale-x-&lt;number&gt; | scale: &lt;number&gt;% var(--baro-scale-y); |
| -scale-x-&lt;number&gt; | scale: calc(&lt;number&gt;% * -1) var(--baro-scale-y); |
| scale-x-(&lt;custom-property&gt;) | scale: var(&lt;custom-property&gt;) var(--baro-scale-y); |
| scale-x-[&lt;value&gt;] | scale: &lt;value&gt; var(--baro-scale-y); |
| scale-y-&lt;number&gt; | scale: var(--baro-scale-x) &lt;number&gt;%; |
| -scale-y-&lt;number&gt; | scale: var(--baro-scale-x) calc(&lt;number&gt;% * -1); |
| scale-y-(&lt;custom-property&gt;) | scale: var(--baro-scale-x) var(&lt;custom-property&gt;); |
| scale-y-[&lt;value&gt;] | scale: var(--baro-scale-x) &lt;value&gt;; |
| scale-z-&lt;number&gt; | scale: var(--baro-scale-x) var(--baro-scale-y) &lt;number&gt;%; |
| -scale-z-&lt;number&gt; | scale: var(--baro-scale-x) var(--baro-scale-y) calc(&lt;number&gt;% * -1); |
| scale-z-(&lt;custom-property&gt;) | scale: var(--baro-scale-x) var(--baro-scale-y) var(&lt;custom-property&gt;); |
| scale-z-[&lt;value&gt;] | scale: var(--baro-scale-x) var(--baro-scale-y) &lt;value&gt;; |
| scale-3d | scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z); |

## Examples

### Basic example

Use `scale-&lt;number&gt;` utilities like `scale-75` and `scale-150` to scale an element by a percentage of its original size:

```html
<img class="scale-75 ..." src="/img/mountains.jpg" />
<img class="scale-100 ..." src="/img/mountains.jpg" />
<img class="scale-125 ..." src="/img/mountains.jpg" />
```

### Scaling on the x-axis

Use the `scale-x-&lt;number&gt;` utilities like `scale-x-75` and `-scale-x-150` to scale an element on the x-axis by a percentage of its original width:

```html
<img class="scale-x-75 ..." src="/img/mountains.jpg" />
<img class="scale-x-100 ..." src="/img/mountains.jpg" />
<img class="scale-x-125 ..." src="/img/mountains.jpg" />
```

### Scaling on the y-axis

Use the `scale-y-&lt;number&gt;` utilities like `scale-y-75` and `scale-y-150` to scale an element on the y-axis by a percentage of its original height:

```html
<img class="scale-y-75 ..." src="/img/mountains.jpg" />
<img class="scale-y-100 ..." src="/img/mountains.jpg" />
<img class="scale-y-125 ..." src="/img/mountains.jpg" />
```

### Using negative values

Use `-scale-&lt;number&gt;`, `-scale-x-&lt;number&gt;` or `-scale-y-&lt;number&gt;` utilities like `-scale-x-75` and `-scale-125` to mirror and scale down an element by a percentage of its original size:

```html
<img class="-scale-x-75 ..." src="/img/mountains.jpg" />
<img class="-scale-100 ..." src="/img/mountains.jpg" />
<img class="-scale-y-125 ..." src="/img/mountains.jpg" />
```

### Using a custom value

Use the `scale-[&lt;value&gt;]` syntax to set the scale based on a completely custom value:

```html
<img class="scale-[1.7] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `scale-(&lt;custom-property&gt;)` syntax:

```html
<img class="scale-(--my-scale) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `scale-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on hover

Prefix a `scale` utility with a variant like `hover:*` to only apply the utility in that state:

```html
<img class="scale-95 hover:scale-120 ..." src="/img/mountains.jpg" />
```


### Responsive design

Prefix a `scale` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="scale-95 md:scale-120 ..." src="/img/mountains.jpg" />
```

