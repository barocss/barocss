# Transitions & Animation

Utilities for transitions and animations.

```html
<button class="transition-colors duration-200 ease-out hover:bg-blue-600 bg-blue-500 text-white px-4 py-2 rounded">
  Save
</button>
```

Custom animation via theme:

```ts
new BrowserRuntime({
  config: {
    theme: {
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        }
      },
      animations: {
        wiggle: 'wiggle 1s ease-in-out infinite'
      }
    }
  }
});
```
