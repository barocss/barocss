# scroll-snap-stop

Utilities for controlling whether you can skip past possible snap positions.



## Quick reference

| Class         | Styles                          |
|---------------|---------------------------------|
| snap-normal   | scroll-snap-stop: normal;       |
| snap-always   | scroll-snap-stop: always;       |

## Examples

### Forcing snap position stops

Use the `snap-always` utility to force the scroll to stop at every snap position:

```html
<div class="snap-x snap-mandatory ...">
  <div class="snap-center snap-always ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Skipping snap position stops

Use the `snap-normal` utility to allow the scroll to skip past snap positions:

```html
<div class="snap-x ...">
  <div class="snap-center snap-normal ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Responsive design

Prefix a `scroll-snap-stop` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="snap-always md:snap-normal ...">
  <!-- ... -->
</div>
```

