# scroll-snap-type

Utilities for controlling how strictly snap points are enforced in a snap container.



## Quick reference

| Class            | Styles                                              |
|------------------|-----------------------------------------------------|
| snap-none        | scroll-snap-type: none;                             |
| snap-x           | scroll-snap-type: x var(--baro-scroll-snap-strictness); |
| snap-y           | scroll-snap-type: y var(--baro-scroll-snap-strictness); |
| snap-both        | scroll-snap-type: both var(--baro-scroll-snap-strictness); |
| snap-mandatory   | --baro-scroll-snap-strictness: mandatory;            |
| snap-proximity   | --baro-scroll-snap-strictness: proximity;            |

## Examples

### Horizontal scroll snapping

Use the `snap-x` utility to enable horizontal scroll snapping:

```html
<div class="snap-x ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Vertical scroll snapping

Use the `snap-y` utility to enable vertical scroll snapping:

```html
<div class="snap-y ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Both axis scroll snapping

Use the `snap-both` utility to enable scroll snapping on both axes:

```html
<div class="snap-both ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Mandatory scroll snapping

Use the `snap-mandatory` utility to enforce strict scroll snapping:

```html
<div class="snap-x snap-mandatory ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Proximity scroll snapping

Use the `snap-proximity` utility to enable proximity-based scroll snapping:

```html
<div class="snap-x snap-proximity ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Disabling scroll snapping

Use the `snap-none` utility to disable scroll snapping:

```html
<div class="snap-none ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Responsive design

Prefix a `scroll-snap-type` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="snap-none md:snap-x ...">
  <!-- ... -->
</div>
```

