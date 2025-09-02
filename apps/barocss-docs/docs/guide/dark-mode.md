# Dark mode

Choose a dark mode strategy in your config.

```ts
// 'media' | 'class' | string[] selectors
new BrowserRuntime({ config: { darkMode: 'class' } });
```

Usage:

```html
<html class="dark">
  <div class="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">...
  </div>
</html>
```
