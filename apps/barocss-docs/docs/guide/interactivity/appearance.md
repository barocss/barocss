# appearance

Utilities for suppressing native form control styling.

Source: https://tailwindcss.com/guide/appearance

## Quick reference

| Class              | Styles              |
|--------------------|---------------------|
| appearance-none    | appearance: none;   |
| appearance-auto    | appearance: auto;   |

## Examples

### Removing default appearance

Use the `appearance-none` utility to remove the default styling from form controls:

```html
<select>
  <option>Yes</option>
  <option>No</option>
  <option>Maybe</option>
</select>

<div class="grid">
  <select class="appearance-none bg-gray-50 dark:bg-gray-800 ...">
    <option>Yes</option>
    <option>No</option>
    <option>Maybe</option>
  </select>
  <svg class="pointer-events-none ..."><!-- ... --></svg>
</div>
```

### Restoring default appearance

Use the `appearance-auto` utility to restore the default styling of form controls:

```html
<input type="checkbox" class="appearance-none forced-colors:appearance-auto" />
```

### Responsive design

Prefix an `appearance` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<select class="appearance-auto md:appearance-none ...">
  <!-- ... -->
</select>
```

Learn more about using variants in the variants documentation.
