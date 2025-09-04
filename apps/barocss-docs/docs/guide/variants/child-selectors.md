# Child selectors

## Styling direct children

Use the `child` variant to style direct children:

```html
<div class="child:bg-gray-100 child:p-2 child:rounded">
  <div>First child</div>
  <div>Second child</div>
  <div>
    <div>Nested child (not styled)</div>
  </div>
</div>
```

## Styling all descendants

Use the `descendant` variant to style all descendants:

```html
<div class="descendant:bg-gray-100 descendant:p-2 descendant:rounded">
  <div>First child</div>
  <div>Second child</div>
  <div>
    <div>Nested child (also styled)</div>
  </div>
</div>
```

## Child selector reference

| Variant | CSS Selector | Description |
|---------|--------------|-------------|
| `child` | `> *` | Direct children |
| `descendant` | `*` | All descendants |
| `sibling` | `~ *` | Following siblings |
| `adjacent-sibling` | `+ *` | Adjacent siblings |
