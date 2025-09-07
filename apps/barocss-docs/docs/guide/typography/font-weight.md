# font-weight

Utilities for controlling the font weight of an element.

## Quick reference

| Class | Styles |
|---|---|
| `font-thin` | `font-weight: 100;` |
| `font-extralight` | `font-weight: 200;` |
| `font-light` | `font-weight: 300;` |
| `font-normal` | `font-weight: 400;` |
| `font-medium` | `font-weight: 500;` |
| `font-semibold` | `font-weight: 600;` |
| `font-bold` | `font-weight: 700;` |
| `font-extrabold` | `font-weight: 800;` |
| `font-black` | `font-weight: 900;` |
| `font-(&lt;custom-property&gt;)` | `font-weight: var(&lt;custom-property&gt;);` |
| `font-[&lt;value&gt;]` | `font-weight: &lt;value&gt;;` |



## Examples

### Basic example

Use utilities like `font-thin` and `font-bold` to set the font weight of an element:

```html
<!-- [!code classes:font-light,font-normal,font-medium,font-semibold,font-bold] -->
<p class="font-light ...">The quick brown fox ...</p>
<p class="font-normal ...">The quick brown fox ...</p>
<p class="font-medium ...">The quick brown fox ...</p>
<p class="font-semibold ...">The quick brown fox ...</p>
<p class="font-bold ...">The quick brown fox ...</p>
```

### Using a custom value

You can use arbitrary values to set a custom font weight:

```html
<p class="font-[1000] ...">Extra heavy</p>
```

### Responsive design

```html
<p class="font-normal md:font-bold ..."></p>
```

## Customizing your theme

You can customize the font weights in your theme by adding entries to the `fontWeight` section of your `tailwind.config.js` file:

```js
module.exports = {
  theme: {
    extend: {
      fontWeight: {
        'extrablack': '1000',
        'ultra': '950',
      }
    }
  }
}
```
