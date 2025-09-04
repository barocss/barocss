# visibility

Utilities for controlling the visibility of an element.

## Quick reference

| Class      | Styles                |
|------------|-----------------------|
| `visible`  | `visibility: visible;`|
| `invisible`| `visibility: hidden;` |
| `collapse` | `visibility: collapse;`|

Source: https://tailwindcss.com/docs/visibility

## Examples

### Making elements invisible

```html
<div class="grid grid-cols-3 gap-4">
  <div>01</div>
  <div class="invisible ...">02</div>
  <div>03</div>
</div>
```

To completely remove an element from the document, use the display property instead.

### Collapsing elements

```html
<table>
  <thead>
    <tr>
      <th>Invoice #</th>
      <th>Client</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>#100</td>
      <td>Pendant Publishing</td>
      <td>$2,000.00</td>
    </tr>
    <tr class="collapse">
      <td>#101</td>
      <td>Kruger Industrial Smoothing</td>
      <td>$545.00</td>
    </tr>
    <tr>
      <td>#102</td>
      <td>J. Peterman</td>
      <td>$10,000.25</td>
    </tr>
  </tbody>
</table>
```

This makes it possible to toggle rows/columns without affecting the table layout.

### Making elements visible

```html
<div class="grid grid-cols-3 gap-4">
  <div>01</div>
  <div class="visible ...">02</div>
  <div>03</div>
</div>
```

This is useful for undoing `invisible` at different screen sizes.

### Responsive design

Prefix a `visibility` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="visible md:invisible ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
