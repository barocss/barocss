# perspective

Utilities for controlling an element's perspective when placed in 3D space.


## Quick reference

| Class                           | Styles                                                  |
| ------------------------------- | ------------------------------------------------------- |
| perspective-dramatic            | perspective: var(--perspective-dramatic); /* 100px */   |
| perspective-near                | perspective: var(--perspective-near); /* 300px */       |
| perspective-normal              | perspective: var(--perspective-normal); /* 500px */     |
| perspective-midrange            | perspective: var(--perspective-midrange); /* 800px */   |
| perspective-distant             | perspective: var(--perspective-distant); /* 1200px */   |
| perspective-none                | perspective: none;                                      |
| perspective-(&lt;custom-property&gt;) | perspective: var(&lt;custom-property&gt;);                    |
| perspective-\[&lt;value&gt;\]         | perspective: &lt;value&gt;;                                   |

## Examples

### Basic example

Use utilities like `perspective-normal` and `perspective-distant` to control how close or how far away the z-plane is from the screen:

perspective-dramatic

1

2

3

4

5

6

perspective-normal

1

2

3

4

5

6

```html
<div class="size-20 perspective-dramatic ...">
  <div class="translate-z-12 rotate-x-0 bg-sky-300/75 ...">1</div>
  <div class="-translate-z-12 rotate-y-18 bg-sky-300/75 ...">2</div>
  <div class="translate-x-12 rotate-y-90 bg-sky-300/75 ...">3</div>
  <div class="-translate-x-12 -rotate-y-90 bg-sky-300/75 ...">4</div>
  <div class="-translate-y-12 rotate-x-90 bg-sky-300/75 ...">5</div>
  <div class="translate-y-12 -rotate-x-90 bg-sky-300/75 ...">6</div>
</div>
<div class="size-20 perspective-normal ...">
  <div class="translate-z-12 rotate-x-0 bg-sky-300/75 ...">1</div>
  <div class="-translate-z-12 rotate-y-18 bg-sky-300/75 ...">2</div>
  <div class="translate-x-12 rotate-y-90 bg-sky-300/75 ...">3</div>
  <div class="-translate-x-12 -rotate-y-90 bg-sky-300/75 ...">4</div>
  <div class="-translate-y-12 rotate-x-90 bg-sky-300/75 ...">5</div>
  <div class="translate-y-12 -rotate-x-90 bg-sky-300/75 ...">6</div>
</div>
```

This is like moving a camera closer to or further away from an object.

### Removing a perspective

Use the `perspective-none` utility to remove a perspective transform from an element:

```html
<div class="perspective-none ...">
  <!-- ... -->
</div>
```

### Using a custom value

Use the `perspective-[&lt;value&gt;]` syntax to set the perspective based on a completely custom value:

```html
<div class="perspective-[750px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `perspective-(&lt;custom-property&gt;)` syntax:

```html
<div class="perspective-(--my-perspective) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `perspective-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `perspective` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="perspective-midrange md:perspective-dramatic ...">
  <!-- ... -->
</div>
```


## Customizing your theme

Use the `--perspective-*` theme variables to customize the perspective utilities in your project:

```css
@theme {
  --perspective-remote: 1800px;
}
```

Now the `perspective-remote` utility can be used in your markup:

```html
<div class="perspective-remote">
  <!-- ... -->
</div>
```


