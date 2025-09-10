# letter-spacing

Utilities for controlling the tracking, or letter spacing, of an element.

## Quick reference

| Class               | Styles                               |
|---------------------|--------------------------------------|
| `tracking-tighter`  | `letter-spacing: var(--tracking-tighter);` |
| `tracking-tight`    | `letter-spacing: var(--tracking-tight);`   |
| `tracking-normal`   | `letter-spacing: var(--tracking-normal);`  |
| `tracking-wide`     | `letter-spacing: var(--tracking-wide);`    |
| `tracking-wider`    | `letter-spacing: var(--tracking-wider);`   |
| `tracking-widest`   | `letter-spacing: var(--tracking-widest);`  |
| `tracking-(&lt;custom-property&gt;)` | `letter-spacing: var(&lt;custom-property&gt;);` |
| `tracking-[&lt;value&gt;]` | `letter-spacing: &lt;value&gt;;`                |


## Examples

### Basic example

Use utilities like `tracking-tight` and `tracking-wide` to set the letter spacing of an element:

tracking-tight

The quick brown fox jumps over the lazy dog.

tracking-normal

The quick brown fox jumps over the lazy dog.

tracking-wide

The quick brown fox jumps over the lazy dog.

```html
<p class="tracking-tight ...">The quick brown fox ...</p>
<p class="tracking-normal ...">The quick brown fox ...</p>
<p class="tracking-wide ...">The quick brown fox ...</p>
```

### Using negative values

Using negative values doesn't make a ton of sense with the named letter spacing scale Tailwind includes out of the box, but if you've customized your scale to use numbers it can be useful:

```css
  --tracking-1: 0em;
  --tracking-2: 0.025em;
  --tracking-3: 0.05em;
  --tracking-4: 0.1em;
```

To use a negative letter spacing value, prefix the class name with a dash to convert it to a negative value:

```html
<p class="-tracking-2">The quick brown fox ...</p>
```

### Using a custom value

Use the `tracking-[&lt;value&gt;]` syntax to set the letter spacing based on a completely custom value:

```html
<p class="tracking-[.25em] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `tracking-(&lt;custom-property&gt;)` syntax:

```html
<p class="tracking-(--my-tracking) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `tracking-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `letter-spacing` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="tracking-tight md:tracking-wide ...">Lorem ipsum dolor sit amet...</p>
```


## Customizing your theme

Use the `--tracking-*` theme variables to customize the letter spacing utilities in your project:

```css
```

Now the `tracking-tightest` utility can be used in your markup:

```html
<p class="tracking-tightest">Lorem ipsum dolor sit amet...</p>
```


