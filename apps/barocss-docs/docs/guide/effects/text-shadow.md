# text-shadow

Utilities for controlling the shadow of a text element.

## Quick reference

| Class | Styles |
|---|---|
| `text-shadow-2xs` | `text-shadow: var(--text-shadow-2xs); /* 0px 1px 0px rgb(0 0 0 / 0.15) */` |
| `text-shadow-xs` | `text-shadow: var(--text-shadow-xs); /* 0px 1px 1px rgb(0 0 0 / 0.2) */` |
| `text-shadow-sm` | `text-shadow: var(--text-shadow-sm); /* 0px 1px 0px rgb(0 0 0 / 0.075), 0px 1px 1px rgb(0 0 0 / 0.075), 0px 2px 2px rgb(0 0 0 / 0.075) */` |
| `text-shadow-md` | `text-shadow: var(--text-shadow-md); /* 0px 1px 1px rgb(0 0 0 / 0.1), 0px 1px 2px rgb(0 0 0 / 0.1), 0px 2px 4px rgb(0 0 0 / 0.1) */` |
| `text-shadow-lg` | `text-shadow: var(--text-shadow-lg); /* 0px 1px 2px rgb(0 0 0 / 0.1), 0px 3px 2px rgb(0 0 0 / 0.1), 0px 4px 8px rgb(0 0 0 / 0.1) */` |
| `text-shadow-none` | `text-shadow: none;` |
| `text-shadow-(&lt;custom-property&gt;)` | `text-shadow: var(&lt;custom-property&gt;);` |
| `text-shadow-(color:&lt;custom-property&gt;)` | `--baro-shadow-color var(&lt;custom-property&gt;);` |
| `text-shadow-[&lt;value&gt;]` | `text-shadow: &lt;value&gt;;` |
| `text-shadow-inherit` | `--baro-shadow-color inherit;` |
| `text-shadow-current` | `--baro-shadow-color currentColor;` |
| `text-shadow-transparent` | `--baro-shadow-color transparent;` |


## Examples

### Basic example

Use utilities like `text-shadow-sm` and `shadow-lg` to apply different sized text shadows to a text element:

```html
<!-- [!code classes:text-shadow-2xs,text-shadow-xs,text-shadow-sm,text-shadow-md,text-shadow-lg,text-shadow-xl] -->
<p class="text-shadow-2xs ...">The quick brown fox...</p>
<p class="text-shadow-xs ...">The quick brown fox...</p>
<p class="text-shadow-sm ...">The quick brown fox...</p>
<p class="text-shadow-md ...">The quick brown fox...</p>
<p class="text-shadow-lg ...">The quick brown fox...</p>
```

### Changing the opacity

Use the opacity modifier to adjust the opacity of the text shadow:

```html
<!-- [!code classes:text-shadow-lg/20,text-shadow-lg/30] -->
<p class="text-shadow-lg ...">The quick brown fox...</p>
<p class="text-shadow-lg/20 ...">The quick brown fox...</p>
<p class="text-shadow-lg/30 ...">The quick brown fox...</p>
```

The default text shadow opacities are quite low (20% or less), so increasing the opacity (to like 50%) will make the text shadows more pronounced.

### Setting the shadow color

Use utilities like `text-shadow-indigo-500` and `text-shadow-cyan-500/50` to change the color of a text shadow:

```html
<!-- [!code classes:text-shadow-sky-300] -->
<button class="text-sky-950 text-shadow-2xs text-shadow-sky-300 ...">Book a demo</button>
<button class="text-gray-950 dark:text-white dark:text-shadow-2xs ...">See pricing</button>
```

By default colored shadows have an opacity of 100% but you can adjust this using the opacity modifier.

### Removing a text shadow

Use the `text-shadow-none` utility to remove an existing text shadow from an element:

```html
<!-- [!code classes:dark:text-shadow-none] -->
<p class="text-shadow-lg dark:text-shadow-none">
  <!-- ... -->
</p>
```

### Using a custom value

Use the `text-shadow-[&lt;value&gt;]` syntax to set the text shadow based on a completely custom value:

```html
<p class="text-shadow-[0_35px_35px_rgb(0_0_0_/_0.25)]">
  Custom
</p>
```

For CSS variables, you can also use the `text-shadow-(&lt;custom-property&gt;)` syntax:

```html
<p class="text-shadow-(--my-text-shadow)">
  <!-- ... -->
</p>
```

This is just a shorthand for `text-shadow-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-shadow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="text-shadow-none md:text-shadow-lg">
  <!-- ... -->
</p>
```


## Customizing your theme

Use the `--text-shadow-*` theme variables to customize the text shadow utilities in your project:

```css
@theme {
  --text-shadow-3xl: 0 35px 35px rgb(0 0 0 / 0.25);
}
```

Now the `text-shadow-3xl` utility can be used in your markup:

```html
<p class="text-shadow-3xl">
  <!-- ... -->
</p>
```


