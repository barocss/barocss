# text-shadow

Utilities for controlling the text shadow of an element.

## Quick reference

| Class | Styles |
|-------|--------|
| `text-shadow-sm` | `text-shadow: 0 1px 2px rgb(0 0 0 / 0.05);` |
| `text-shadow` | `text-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);` |
| `text-shadow-md` | `text-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);` |
| `text-shadow-lg` | `text-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);` |
| `text-shadow-xl` | `text-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);` |
| `text-shadow-2xl` | `text-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);` |
| `text-shadow-none` | `text-shadow: none;` |
| `text-shadow-(&lt;custom-property&gt;)` | `text-shadow: var(&lt;custom-property&gt;);` |
| `text-shadow-[&lt;value&gt;]` | `text-shadow: &lt;value&gt;;` |

## Examples

### Basic example

Use utilities like `text-shadow-sm` and `text-shadow-lg` to apply different sized text shadows to an element:

```html
<p class="text-shadow-sm">The quick brown fox jumps over the lazy dog.</p>
<p class="text-shadow">The quick brown fox jumps over the lazy dog.</p>
<p class="text-shadow-lg">The quick brown fox jumps over the lazy dog.</p>
```

### Removing text shadow

Use the `text-shadow-none` utility to remove an existing text shadow from an element:

```html
<p class="text-shadow-lg md:text-shadow-none">The quick brown fox jumps over the lazy dog.</p>
```

### Using a custom value

You can use arbitrary values to set a custom text shadow:

```html
<p class="text-shadow-[0_2px_4px_rgba(0,0,0,0.1)]">Custom shadow</p>
```

## Responsive & variants

```html
<p class="text-shadow-none md:text-shadow-lg"></p>
```


