# pointer-events

Utilities for controlling whether an element responds to pointer events.



## Quick reference

| Class | Styles |
|---|---|
| pointer-events-auto | pointer-events: auto; |
| pointer-events-none | pointer-events: none; |

## Examples

### Ignoring pointer events

Use the `pointer-events-none` utility to make an element ignore pointer events, like `:hover` and `click` events:

```html
<div class="relative ...">
  <div class="pointer-events-auto absolute ...">
    <svg class="absolute h-5 w-5 text-gray-400">
      <!-- ... -->
    </svg>
  </div>
  <input type="text" placeholder="Search" class="..." />
</div>

<div class="relative ...">
  <div class="pointer-events-none absolute ...">
    <svg class="absolute h-5 w-5 text-gray-400">
      <!-- ... -->
    </svg>
  </div>
  <input type="text" placeholder="Search" class="..." />
</div>
```

The pointer events will still trigger on child elements and pass-through to elements that are "beneath" the target.

### Restoring pointer events

Use the `pointer-events-auto` utility to revert to the default browser behavior for pointer events:

```html
<div class="pointer-events-none md:pointer-events-auto ...">
  <!-- ... -->
</div>
```

### Responsive design

Prefix a `pointer-events` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="pointer-events-none md:pointer-events-auto ...">
  <!-- ... -->
</div>
```

