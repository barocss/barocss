# caption-side

Utilities for controlling the alignment of a caption element inside of a table.



## Quick reference

| Class            | Styles                   |
|------------------|--------------------------|
| caption-top      | caption-side: top;       |
| caption-bottom   | caption-side: bottom;    |

## Examples

### Placing at top of table

```html
<table class="table-auto">
  <caption class="caption-top">Table 3.1: Professional wrestlers and their signature moves.</caption>
  <thead>
    <tr>
      <th>Wrestler</th>
      <th>Signature Move(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>"Stone Cold" Steve Austin</td>
      <td>Stone Cold Stunner, Lou Thesz Press</td>
    </tr>
  </tbody>
</table>
```

### Placing at bottom of table

```html
<table class="table-auto">
  <caption class="caption-bottom">Table 3.1: Professional wrestlers and their signature moves.</caption>
  <thead>
    <tr>
      <th>Wrestler</th>
      <th>Signature Move(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>"Stone Cold" Steve Austin</td>
      <td>Stone Cold Stunner, Lou Thesz Press</td>
    </tr>
  </tbody>
</table>
```

### Responsive design

Prefix a `caption-side` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<caption class="caption-top md:caption-bottom ...">
  <!-- ... -->
</caption>
```

