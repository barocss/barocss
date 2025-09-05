# font-stretch

Utilities for controlling the horizontal stretching of text.

## Quick reference

| Class | Styles |
|-------|--------|
| `font-stretch-&lt;value&gt;` | `font-stretch: &lt;value&gt;;` |
| `font-stretch-(&lt;custom-property&gt;)` | `font-stretch: var(&lt;custom-property&gt;);` |
| `font-stretch-[&lt;value&gt;]` | `font-stretch: &lt;value&gt;;` |

## Examples

### Basic example

Use utilities like `font-stretch-75` and `font-stretch-125` to control the horizontal stretching of text:

```html
<p class="font-stretch-75">The quick brown fox jumps over the lazy dog.</p>
<p class="font-stretch-125">The quick brown fox jumps over the lazy dog.</p>
```

### Using a custom value

You can use arbitrary values to set a custom font stretch:

```html
<p class="font-stretch-[150%]">Custom stretch</p>
```

## Responsive & variants

```html
<p class="font-stretch-75 md:font-stretch-125"></p>
```

## Customizing your theme

You can customize the font stretches in your theme by adding entries to the `fontStretch` section of your `tailwind.config.js` file:

```js
module.exports = {
  theme: {
    extend: {
      fontStretch: {
        'ultra-condensed': '50%',
        'extra-condensed': '62.5%',
        'condensed': '75%',
        'semi-condensed': '87.5%',
        'normal': '100%',
        'semi-expanded': '112.5%',
        'expanded': '125%',
        'extra-expanded': '150%',
        'ultra-expanded': '200%',
      }
    }
  }
}
```


