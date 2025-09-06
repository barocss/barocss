# Quick Start

::: tip Get Started in Minutes
BaroCSS is designed to get you productive quickly. Follow these simple steps to have your first styled component running in under 5 minutes.
:::

## 1. Install

::: details Package Manager Installation
```bash
pnpm add @barocss/kit
```

Or with other package managers:
```bash
npm install @barocss/kit
yarn add @barocss/kit
```
:::

::: details CDN Installation (for prototypes)
```html
<script src="https://unpkg.com/@barocss/kit@latest/dist/runtime/browser.js"></script>
<script>
  const runtime = new BaroCSS.BrowserRuntime();
  runtime.observe(document.body, { scan: true });
</script>
```
:::

## 2. Initialize Runtime

::: details Basic Setup
```ts
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    preflight: true,
  }
});

runtime.observe(document.body, { scan: true });
```
:::

::: tip What This Does
- Creates a BaroCSS runtime instance
- Enables preflight styles (CSS reset)
- Starts observing the DOM for class changes
- Generates CSS in real-time as you add classes
:::

## 3. Use Utilities

::: details Your First Styled Component
```html
<div class="p-4 rounded-lg bg-blue-500 text-white">
  Hello BaroCSS!
</div>
```

**What happens:**
- BaroCSS detects the classes: `p-4`, `rounded-lg`, `bg-blue-500`, `text-white`
- Generates CSS for each class instantly
- Styles are applied immediately (no build step!)
:::

## 4. Customize Theme

::: details Theme Configuration
```ts
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    preflight: 'minimal',
    theme: {
      colors: { 
        primary: '#3B82F6',
        secondary: '#8B5CF6'
      }
    }
  }
});
```

**Now you can use:**
```html
<div class="bg-primary text-white">Custom color!</div>
```
:::

## 5. Next Steps

::: tip Ready for More?
Now that you have BaroCSS running, explore these advanced topics:
:::

- **[Runtime API](/guide/runtime-api)** - Learn about the BrowserRuntime API
- **[Theme Configuration](/guide/theme)** - Customize your design system
- **[Custom Utilities](/guide/adding-custom-styles)** - Create your own utilities
- **[JIT Mode](/guide/jit-mode)** - Understand how real-time CSS generation works
- **[AI Integration](/guide/ai-integration)** - Connect with AI-generated UI
