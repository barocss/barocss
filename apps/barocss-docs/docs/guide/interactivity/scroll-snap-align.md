# scroll-snap-align

Utilities for controlling the scroll snap alignment of an element.

Source: https://tailwindcss.com/guide/scroll-snap-align

## Quick reference

| Class              | Styles                          |
|--------------------|---------------------------------|
| snap-start         | scroll-snap-align: start;       |
| snap-end           | scroll-snap-align: end;         |
| snap-center        | scroll-snap-align: center;      |
| snap-align-none    | scroll-snap-align: none;        |

## Examples

### Snapping to the center

Use the `snap-center` utility to align elements to the center of the snap container:

```html
<div class="snap-x ...">
  <div class="snap-center ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <div class="snap-center ...">
    <img src="/img/vacation-02.jpg" />
  </div>
</div>
```

### Snapping to the start

Use the `snap-start` utility to align elements to the start of the snap container:

```html
<div class="snap-x ...">
  <div class="snap-start ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Snapping to the end

Use the `snap-end` utility to align elements to the end of the snap container:

```html
<div class="snap-x ...">
  <div class="snap-end ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Disabling snap alignment

Use the `snap-align-none` utility to disable snap alignment for an element:

```html
<div class="snap-x ...">
  <div class="snap-align-none ...">
    <img src="/img/vacation-01.jpg" />
  </div>
</div>
```

### Responsive design

Prefix a `scroll-snap-align` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="snap-center md:snap-start ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
