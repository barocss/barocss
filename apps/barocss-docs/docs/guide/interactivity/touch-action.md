# touch-action

Utilities for controlling how an element can be scrolled and zoomed on touchscreens.



## Quick reference

| Class                | Styles                    |
|----------------------|---------------------------|
| touch-auto           | touch-action: auto;       |
| touch-none           | touch-action: none;       |
| touch-pan-x          | touch-action: pan-x;      |
| touch-pan-left       | touch-action: pan-left;   |
| touch-pan-right      | touch-action: pan-right;  |
| touch-pan-y          | touch-action: pan-y;      |
| touch-pan-up         | touch-action: pan-up;     |
| touch-pan-down       | touch-action: pan-down;   |
| touch-pinch-zoom     | touch-action: pinch-zoom; |
| touch-manipulation   | touch-action: manipulation; |

## Examples

### Basic example

Use utilities like `touch-pan-y` and `touch-pan-x` to control how an element can be scrolled and zoomed on touchscreens:

```html
<div class="h-48 w-full touch-pan-y overflow-auto ...">
  <img class="w-[150%] max-w-none" src="..." />
</div>
```

### Disabling touch actions

Use the `touch-none` utility to disable all touch actions on an element:

```html
<div class="touch-none ...">
  <!-- ... -->
</div>
```

### Enabling pinch zoom

Use the `touch-pinch-zoom` utility to enable pinch zoom gestures:

```html
<div class="touch-pinch-zoom ...">
  <!-- ... -->
</div>
```

### Using manipulation

Use the `touch-manipulation` utility to enable panning and pinch zoom gestures but disable other non-standard gestures:

```html
<div class="touch-manipulation ...">
  <!-- ... -->
</div>
```

### Responsive design

Prefix a `touch-action` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="touch-pan-x md:touch-auto ...">
  <!-- ... -->
</div>
```

