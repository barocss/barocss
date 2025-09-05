# transition-behavior

Utilities to control the behavior of CSS transitions.

Source: https://tailwindcss.com/guide/transition-behavior

## Quick reference

| Class               | Styles                               |
| ------------------- | ------------------------------------ |
| transition-normal   | transition-behavior: normal;         |
| transition-discrete | transition-behavior: allow-discrete; |

## Examples

### Basic example

Use the `transition-discrete` utility to start transitions when changing properties with a discrete set of values, such as elements that change from `hidden` to `block`:

Interact with the checkboxes to see the expected behavior

transition-normalI hide

transition-discreteI fade out

```html
<label class="peer ...">
  <input type="checkbox" checked />
</label>
<button class="hidden transition-all not-peer-has-checked:opacity-0 peer-has-checked:block ...">
  I hide
</button>

<label class="peer ...">
  <input type="checkbox" checked />
</label>
<button class="hidden transition-all transition-discrete not-peer-has-checked:opacity-0 peer-has-checked:block ...">
  I fade out
</button>
```

### Responsive design

Prefix a `transition-behavior` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<button class="transition-discrete md:transition-normal ...">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
