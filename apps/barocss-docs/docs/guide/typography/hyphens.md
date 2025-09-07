# hyphens

Utilities for controlling how words should be hyphenated.

## Quick reference

| Class           | Styles            |
|-----------------|-------------------|
| `hyphens-none`  | `hyphens: none;`  |
| `hyphens-manual`| `hyphens: manual;`|
| `hyphens-auto`  | `hyphens: auto;`  |



## Examples

### Preventing hyphenation

Use the `hyphens-none` utility to prevent hyphenation:

```html
<p class="hyphens-none ...">Kraftfahrzeug&shy;haftpflichtversicherung ...</p>
```

### Manual hyphenation

Use the `hyphens-manual` utility to only hyphenate at manually inserted points:

```html
<p class="hyphens-manual ...">Kraftfahrzeug&shy;haftpflichtversicherung ...</p>
```

### Automatic hyphenation

Use the `hyphens-auto` utility to automatically hyphenate words:

```html
<p class="hyphens-auto ..." lang="de">Kraftfahrzeughaftpflichtversicherung ...</p>
```

### Responsive design

Prefix a `hyphens` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="hyphens-none md:hyphens-auto ...">Lorem ipsum dolor sit amet...</p>
```

