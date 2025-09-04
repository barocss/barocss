# Custom variants

## Using arbitrary variants

Use arbitrary variants to create custom selectors:

```html
<div class="[&>[data-active]+span]:text-blue-600 ...">
  <span data-active><!-- ... --></span>
  <span>This text will be blue</span>
</div>
```

## Registering a custom variant

Register custom variants using the `@variant` directive:

```css
@variant custom-hover {
  @media (hover: hover) {
    &:hover {
      @apply;
    }
  }
}
```

Then use it in your HTML:

```html
<div class="custom-hover:bg-blue-500">
  Custom hover variant
</div>
```
