# background-size

Utilities for controlling the background size of an element's background image.

## Quick reference

| Class | Styles |
|---|---|
| `bg-auto` | `background-size: auto;` |
| `bg-cover` | `background-size: cover;` |
| `bg-contain` | `background-size: contain;` |
| `bg-size-(&lt;custom-property&gt;)` | `background-size: var(&lt;custom-property&gt;);` |
| `bg-size-[&lt;value&gt;]` | `background-size: &lt;value&gt;;` |



## Examples

### Filling the container

Use the `bg-cover` utility to scale the background image until it fills the background layer, cropping the image if needed:

```html
<!-- [!code classes:bg-cover] -->
<div class="bg-[url(/img/mountains.jpg)] bg-cover bg-center"></div>
```

### Filling without cropping

Use the `bg-contain` utility to scale the background image to the outer edges without cropping or stretching:

```html
<!-- [!code classes:bg-contain] -->
<div class="bg-[url(/img/mountains.jpg)] bg-contain bg-center"></div>
```

### Using the default size

Use the `bg-auto` utility to display the background image at its default size:

```html
<!-- [!code classes:bg-auto] -->
<div class="bg-[url(/img/mountains.jpg)] bg-auto bg-center bg-no-repeat"></div>
```

### Using a custom value

Use the `bg-size-[&lt;value&gt;]` syntax to set the background size based on a completely custom value:

```html
<div class="bg-size-[auto_100px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `bg-size-(&lt;custom-property&gt;)` syntax:

```html
<div class="bg-size-(--my-size) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `bg-size-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `background-size` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="bg-auto md:bg-contain ...">
  <!-- ... -->
</div>
```


