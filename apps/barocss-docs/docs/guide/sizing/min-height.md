# min-height

Utilities for setting the minimum height of an element.

## Quick reference

| Class                    | Styles                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| min-h-&lt;number&gt;           | min-height: calc(var(--spacing) \* &lt;number&gt;);                                      |
| min-h-&lt;fraction&gt;         | min-height: calc(&lt;fraction&gt; \* 100%);                                              |
| min-h-px                 | min-height: 1px;                                                                   |
| min-h-full               | min-height: 100%;                                                                  |
| min-h-screen             | min-height: 100vh;                                                                 |
| min-h-dvh                | min-height: 100dvh;                                                                |
| min-h-dvw                | min-height: 100dvw;                                                                |
| min-h-lvh                | min-height: 100lvh;                                                                |
| min-h-lvw                | min-height: 100lvw;                                                                |
| min-h-svh                | min-height: 100svh;                                                                |
| min-h-svw                | min-height: 100svw;                                                                |
| min-h-auto               | min-height: auto;                                                                  |
| min-h-min                | min-height: min-content;                                                           |
| min-h-max                | min-height: max-content;                                                           |
| min-h-fit                | min-height: fit-content;                                                           |
| min-h-lh                 | min-height: 1lh;                                                                   |
| min-h-(&lt;custom-property&gt;)| min-height: var(&lt;custom-property&gt;);                                                |
| min-h-\[&lt;value&gt;\]        | min-height: &lt;value&gt;;                                                               |



## Examples

### Basic example

Use `min-h-&lt;number&gt;` utilities like `min-h-24` and `min-h-64` to set an element to a fixed minimum height based on the spacing scale:

min-h-96

min-h-80

min-h-64

min-h-48

min-h-40

min-h-32

min-h-24

```
<div class="h-20 ...">
  <div class="min-h-96 ...">min-h-96</div>
  <div class="min-h-80 ...">min-h-80</div>
  <div class="min-h-64 ...">min-h-64</div>
  <div class="min-h-48 ...">min-h-48</div>
  <div class="min-h-40 ...">min-h-40</div>
  <div class="min-h-32 ...">min-h-32</div>
  <div class="min-h-24 ...">min-h-24</div>
</div>
```

### Using a percentage

Use `min-h-full` or `min-h-&lt;fraction&gt;` utilities like `min-h-1/2` and `min-h-3/4` to give an element a percentage-based minimum height:

min-h-full

min-h-9/10

min-h-3/4

min-h-1/2

min-h-1/3

```
<div class="flex h-96 items-end gap-4 ...">
  <div class="min-h-full w-8 ...">min-h-full</div>
  <div class="min-h-9/10 w-8 ...">min-h-9/10</div>
  <div class="min-h-3/4 w-8 ...">min-h-3/4</div>
  <div class="min-h-1/2 w-8 ...">min-h-1/2</div>
  <div class="min-h-1/3 w-8 ...">min-h-1/3</div>
</div>
```

### Matching the viewport

Use the `min-h-screen` utility to make an element span at least the entire height of the viewport:

```
<div class="min-h-screen">
  <!-- ... -->
</div>
```

Alternatively, you can match the height of the large, small or dynamic viewports using the `min-h-lvh`, `min-h-svh`, and `min-h-dvh` utilities.

### Resetting the minimum height

Use the `min-h-0` utility to remove an element's assigned minimum height under a specific condition, like at a particular breakpoint:

```
<div class="h-24 min-h-0 md:min-h-full">
  <!-- ... -->
</div>
```

### Using a custom value

Use the `min-h-[&lt;value&gt;]` syntax to set the minimum height based on a completely custom value:

```
<div class="min-h-[220px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `min-h-(&lt;custom-property&gt;)` syntax:

```
<div class="min-h-(--my-min-height) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `min-h-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `min-height` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<div class="h-24 min-h-0 md:min-h-full ...">
  <!-- ... -->
</div>
```


## Customizing your theme

The `min-h-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
