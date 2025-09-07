# max-width

Utilities for setting the maximum width of an element.

## Quick reference

| Class                    | Styles                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| max-w-&lt;number&gt;           | max-width: calc(var(--spacing) \* &lt;number&gt;);                                       |
| max-w-&lt;fraction&gt;         | max-width: calc(&lt;fraction&gt; \* 100%);                                               |
| max-w-3xs                | max-width: var(--container-3xs); /\* 16rem (256px) \*/                             |
| max-w-2xs                | max-width: var(--container-2xs); /\* 18rem (288px) \*/                             |
| max-w-xs                 | max-width: var(--container-xs); /\* 20rem (320px) \*/                              |
| max-w-sm                 | max-width: var(--container-sm); /\* 24rem (384px) \*/                              |
| max-w-md                 | max-width: var(--container-md); /\* 28rem (448px) \*/                              |
| max-w-lg                 | max-width: var(--container-lg); /\* 32rem (512px) \*/                              |
| max-w-xl                 | max-width: var(--container-xl); /\* 36rem (576px) \*/                              |
| max-w-2xl                | max-width: var(--container-2xl); /\* 42rem (672px) \*/                             |
| max-w-3xl                | max-width: var(--container-3xl); /\* 48rem (768px) \*/                             |
| max-w-4xl                | max-width: var(--container-4xl); /\* 56rem (896px) \*/                             |
| max-w-5xl                | max-width: var(--container-5xl); /\* 64rem (1024px) \*/                            |
| max-w-6xl                | max-width: var(--container-6xl); /\* 72rem (1152px) \*/                            |
| max-w-7xl                | max-width: var(--container-7xl); /\* 80rem (1280px) \*/                            |
| max-w-none               | max-width: none;                                                                   |
| max-w-px                 | max-width: 1px;                                                                    |
| max-w-full               | max-width: 100%;                                                                   |
| max-w-screen             | max-width: 100vw;                                                                  |
| max-w-dvw                | max-width: 100dvw;                                                                 |
| max-w-dvh                | max-width: 100dvh;                                                                 |
| max-w-lvw                | max-width: 100lvw;                                                                 |
| max-w-lvh                | max-width: 100lvh;                                                                 |
| max-w-svw                | max-width: 100svw;                                                                 |
| max-w-svh                | max-width: 100svh;                                                                 |
| max-w-min                | max-width: min-content;                                                            |
| max-w-max                | max-width: max-content;                                                            |
| max-w-fit                | max-width: fit-content;                                                            |
| max-w-(&lt;custom-property&gt;)| max-width: var(&lt;custom-property&gt;);                                                 |
| max-w-\[&lt;value&gt;\]        | max-width: &lt;value&gt;;                                                                |



## Examples

### Basic example

Use `max-w-&lt;number&gt;` utilities like `max-w-24` and `max-w-64` to set an element to a fixed maximum width based on the spacing scale:

max-w-96

max-w-80

max-w-64

max-w-48

max-w-40

max-w-32

max-w-24

```
<div class="w-full max-w-96 ...">max-w-96</div>
<div class="w-full max-w-80 ...">max-w-80</div>
<div class="w-full max-w-64 ...">max-w-64</div>
<div class="w-full max-w-48 ...">max-w-48</div>
<div class="w-full max-w-40 ...">max-w-40</div>
<div class="w-full max-w-32 ...">max-w-32</div>
<div class="w-full max-w-24 ...">max-w-24</div>
```

### Using a percentage

Use `max-w-full` or `max-w-&lt;fraction&gt;` utilities like `max-w-1/2` and `max-w-3/4` to give an element a percentage-based maximum width:

max-w-9/10

max-w-3/4

max-w-1/2

max-w-1/3

```
<div class="w-full max-w-9/10 ...">max-w-9/10</div>
<div class="w-full max-w-3/4 ...">max-w-3/4</div>
<div class="w-full max-w-1/2 ...">max-w-1/2</div>
<div class="w-full max-w-1/3 ...">max-w-1/3</div>
```

### Using the container scale

Use utilities like `max-w-sm` and `max-w-xl` to set an element to a fixed maximum width based on the container scale:

```
<div class="max-w-md ...">
  <!-- content -->
</div>
```

### Using breakpoints container

Use the `container` utility to set a responsive fixed maximum width that changes based on the current breakpoint:

```
<div class="container">
  <!-- content -->
</div>
```

You can also center the container and add horizontal padding:

```
<div class="container mx-auto px-4">
  <!-- content -->
</div>
```

### Matching the viewport

Use the `max-w-screen` utility to make an element span at most the entire width of the viewport:

```
<div class="max-w-screen">
  <!-- ... -->
</div>
```

Alternatively, you can match the width of the large, small or dynamic viewports using the `max-w-lvw`, `max-w-svw`, and `max-w-dvw` utilities.

### Removing the maximum width

Use the `max-w-none` utility to remove an element's assigned maximum width under a specific condition, like at a particular breakpoint:

```
<div class="max-w-md md:max-w-none">
  <!-- ... -->
</div>
```

### Using a custom value

Use the `max-w-[&lt;value&gt;]` syntax to set the maximum width based on a completely custom value:

```
<div class="max-w-[220px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `max-w-(&lt;custom-property&gt;)` syntax:

```
<div class="max-w-(--my-max-width) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `max-w-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `max-width` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<div class="max-w-sm md:max-w-lg ...">
  <!-- ... -->
</div>
```


## Customizing your theme

The `max-w-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
