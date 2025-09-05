# outline-style

Utilities for controlling the style of an element's outline.

## Quick reference

| Class             | Styles                   |
|-------------------|--------------------------|
| `outline-solid`   | `outline-style: solid;`  |
| `outline-dashed`  | `outline-style: dashed;` |
| `outline-dotted`  | `outline-style: dotted;` |
| `outline-double`  | `outline-style: double;` |
| `outline-none`    | `outline-style: none;`   |
| `outline-hidden`  | `outline: 2px solid transparent; outline-offset: 2px;` |

Source: https://tailwindcss.com/guide/outline-style

## Examples

### Basic example

Use utilities like `outline-solid` and `outline-dashed` to control an element's outline style:

```
<button class="outline-2 outline-offset-2 outline-indigo-500 outline-solid">Button A</button>
<button class="outline-2 outline-offset-2 outline-indigo-500 outline-dashed">Button B</button>
<button class="outline-2 outline-offset-2 outline-indigo-500 outline-dotted">Button C</button>
<button class="outline-3 outline-offset-2 outline-indigo-500 outline-double">Button D</button>
```

### Hiding an outline

Use the `outline-hidden` utility to hide an outline while maintaining its space:

```
<input class="focus:outline-hidden" type="text" />
```

### Removing outlines

Use the `outline-none` utility to remove an existing outline from an element:

```
<textarea class="outline-none" placeholder="Leave a comment..."></textarea>
```

### Responsive design

Prefix an `outline-style` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="outline md:outline-dashed">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
