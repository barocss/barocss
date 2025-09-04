# word-break

Utilities for controlling word breaks in an element.

## Quick reference

| Class           | Styles                      |
|-----------------|-----------------------------|
| `break-normal`  | `word-break: normal;`       |
| `break-all`     | `word-break: break-all;`    |
| `break-keep`    | `word-break: keep-all;`     |

Source: https://tailwindcss.com/docs/word-break

## Examples

### Normal

Use the `break-normal` utility to use the default word breaking rules:

```html
<p class="break-normal ...">The longest word in any of the major...</p>
```

### Break All

Use the `break-all` utility to break words at any character:

```html
<p class="break-all ...">The longest word in any of the major...</p>
```

### Break Keep (CJK)

Use the `break-keep` utility to prevent word breaks for CJK (Chinese, Japanese, Korean) text:

```html
<p class="break-keep ...">抗衡不屈不挠...</p>
```

### Responsive design

Prefix a `word-break` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="break-normal md:break-all ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
