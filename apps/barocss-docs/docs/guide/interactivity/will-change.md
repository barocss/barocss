# will-change

Utilities for optimizing upcoming animations of elements that are expected to change.



## Quick reference

| Class                         | Styles                               |
| ----------------------------- | ------------------------------------ |
| will-change-auto              | will-change: auto;                   |
| will-change-scroll            | will-change: scroll-position;        |
| will-change-contents          | will-change: contents;               |
| will-change-transform         | will-change: transform;              |
| will-change-&lt;custom-property&gt; | will-change: var(&lt;custom-property&gt;); |
| will-change-[&lt;value&gt;]         | will-change: &lt;value&gt;;                |

## Examples

### Optimizing with will change

Use the `will-change-scroll`, `will-change-contents` and `will-change-transform` utilities to optimize an element that's expected to change in the near future by instructing the browser to prepare the necessary animation before it actually begins:

```html
<div class="overflow-auto will-change-scroll ...">
  <!-- ... -->
</div>
```

It's recommended that you apply these utilities just before an element changes, and then remove it shortly after it finishes using `will-change-auto`.

The `will-change` property is intended to be used as a last resort when dealing with **known performance problems**. Avoid using these utilities too much, or simply in anticipation of performance issues, as it could actually cause the page to be less performant.

### Using a custom value

Use the `will-change-[&lt;value&gt;]` syntax to set the `will-change` property based on a completely custom value:

```html
<div class="will-change-[top,left] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `will-change-(&lt;custom-property&gt;)` syntax:

```html
<div class="will-change-(--my-properties) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `will-change-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `will-change` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="will-change-auto md:will-change-transform ...">
  <!-- ... -->
</div>
```

