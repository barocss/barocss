# field-sizing

Utilities for controlling the sizing of form controls.

Source: https://tailwindcss.com/guide/field-sizing

## Quick reference

| Class                 | Styles                 |
|-----------------------|------------------------|
| field-sizing-fixed    | field-sizing: fixed;   |
| field-sizing-content  | field-sizing: content; |

## Examples

### Sizing based on content

Use the `field-sizing-content` utility to make form controls size themselves based on their content:

```html
<textarea class="field-sizing-content ..." rows="2">
  Latex Salesman, Vanderlay Industries
</textarea>
```

### Using a fixed size

Use the `field-sizing-fixed` utility to make form controls use a fixed size instead of sizing based on content:

```html
<textarea class="field-sizing-fixed w-80 ..." rows="2">
  Latex Salesman, Vanderlay Industries
</textarea>
```

### Responsive design

Prefix a `field-sizing` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<input class="field-sizing-content md:field-sizing-fixed ..." />
```

Learn more about using variants in the variants documentation.
