# isolation

Utilities for controlling whether an element should explicitly create a new stacking context.

## Quick reference

| Class            | Styles                |
|------------------|-----------------------|
| `isolate`        | `isolation: isolate;` |
| `isolation-auto` | `isolation: auto;`    |


## Examples

### Basic example

Use the `isolate` utility to create a new stacking context:

```html
<div class="isolate ...">
  <!-- content -->
</div>
```

### Responsive design

Prefix an `isolation` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="isolate md:isolation-auto ...">Lorem ipsum dolor sit amet...</div>
```

