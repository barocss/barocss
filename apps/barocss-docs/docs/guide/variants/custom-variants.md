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

Register custom variants using the `functionalModifier` API:

```typescript
import { functionalModifier } from '@barocss/kit';

functionalModifier({
  name: 'custom-hover',
  match: (input) => input.startsWith('custom-hover:'),
  handle: (input, { wrap }) => {
    const className = input.slice('custom-hover:'.length);
    return wrap('rule', '&:hover', [/* utility styles */]);
  }
});
```

Then use it in your HTML:

```html
<div class="custom-hover:bg-blue-500">
  Custom hover variant
</div>
```
