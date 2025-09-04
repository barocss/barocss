# Customizing Your Theme

The default theme variables are very general purpose and suitable for building dramatically different designs, but they are still just a starting point. It's very common to customize things like the color palette, fonts, and shadows to build exactly the design you have in mind.

## Extending the Default Theme

Use `@theme` to define new theme variables and extend the default theme:

```css
@import "tailwindcss";

@theme {
  --font-script: Great Vibes, cursive;
}
```

This makes a new `font-script` utility class available that you can use in your HTML, just like the default `font-sans` or `font-mono` utilities:

```html
<p class="font-script">This will use the Great Vibes font family.</p>
```

### Adding Custom Colors

```css
@theme {
  --color-brand: oklch(0.72 0.11 221.19);
  --color-accent: oklch(0.74 0.17 40.24);
  --color-neutral: oklch(0.79 0.06 74.59);
}
```

### Adding Custom Spacing

```css
@theme {
  --spacing-18: 4.5rem;
  --spacing-72: 18rem;
  --spacing-96: 24rem;
}
```

### Adding Custom Breakpoints

```css
@theme {
  --breakpoint-3xl: 120rem;
  --breakpoint-4xl: 160rem;
}
```

## Overriding the Default Theme

Override a default theme variable value by redefining it within `@theme`:

```css
@import "tailwindcss";

@theme {
  --breakpoint-sm: 30rem;
}
```

Now the `sm:*` variant will trigger at 30rem instead of the default 40rem viewport size:

```html
<div class="grid grid-cols-1 sm:grid-cols-3">
  <!-- ... -->
</div>
```

### Overriding Individual Values

```css
@theme {
  --color-red-500: oklch(0.6 0.2 20);
  --font-sans: "Inter", sans-serif;
  --spacing: 0.5rem;
}
```

### Overriding Entire Namespaces

To completely override an entire namespace in the default theme, set the entire namespace to `initial` using the special asterisk syntax:

```css
@import "tailwindcss";

@theme {
  --color-*: initial;
  --color-white: #fff;
  --color-purple: #3f3cbb;
  --color-midnight: #121063;
  --color-tahiti: #3ab7bf;
  --color-bermuda: #78dcca;
}
```

When you do this, all of the default utilities that use that namespace _(like `bg-red-500`)_ will be removed, and only your custom values _(like `bg-midnight`)_ will be available.

### Overriding Multiple Namespaces

```css
@theme {
  --color-*: initial;
  --font-*: initial;
  --shadow-*: initial;
  
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
  
  --font-body: "Inter", sans-serif;
  --font-heading: "Inter Display", sans-serif;
  
  --shadow-soft: 0 2px 8px rgb(0 0 0 / 0.1);
  --shadow-medium: 0 4px 16px rgb(0 0 0 / 0.15);
}
```

## Using a Custom Theme

To completely disable the default theme and use only custom values, set the global theme variable namespace to `initial`:

```css
@import "tailwindcss";

@theme {
  --*: initial;

  --spacing: 4px;

  --font-body: Inter, sans-serif;

  --color-lagoon: oklch(0.72 0.11 221.19);
  --color-coral: oklch(0.74 0.17 40.24);
  --color-driftwood: oklch(0.79 0.06 74.59);
  --color-tide: oklch(0.49 0.08 205.88);
  --color-dusk: oklch(0.82 0.15 72.09);
}
```

Now none of the default utility classes that are driven by theme variables will be available, and you'll only be able to use utility classes matching your custom theme variables like `font-body` and `text-dusk`.

## Defining Animation Keyframes

Define the `@keyframes` rules for your `--animate-*` theme variables within `@theme` to include them in your generated CSS:

```css
@import "tailwindcss";

@theme {
  --animate-fade-in-scale: fade-in-scale 0.3s ease-out;

  @keyframes fade-in-scale {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
}
```

If you want your custom `@keyframes` rules to always be included even when not adding an `--animate-*` theme variable, define them outside of `@theme` instead:

```css
@keyframes custom-bounce {
  0%, 100% {
    transform: translateY(-25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
```

## Referencing Other Variables

When defining theme variables that reference other variables, use the `inline` option:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-inter);
}
```

Using the `inline` option, the utility class will use the theme variable _value_ instead of referencing the actual theme variable:

```css
.font-sans {
  font-family: var(--font-inter);
}
```

Without using `inline`, your utility classes might resolve to unexpected values because of how variables are resolved in CSS.

For example, this text will fall back to `sans-serif` instead of using `Inter` like you might expect:

```html
<div id="parent" style="--font-sans: var(--font-inter, sans-serif);">
  <div id="child" style="--font-inter: Inter; font-family: var(--font-sans);">
    This text will use the sans-serif font, not Inter.
  </div>
</div>
```

This happens because `var(--font-sans)` is resolved where `--font-sans` is defined _(on `#parent`)_, and `--font-inter` has no value there since it's not defined until deeper in the tree _(on `#child`)_.

## Generating All CSS Variables

By default only used CSS variables will be generated in the final CSS output. If you want to always generate all CSS variables, you can use the `static` theme option:

```css
@import "tailwindcss";

@theme static {
  --color-primary: var(--color-red-500);
  --color-secondary: var(--color-blue-500);
}
```

## Sharing Across Projects

Since theme variables are defined in CSS, sharing them across projects is just a matter of throwing them into their own CSS file that you can import in each project:

```css
/* ./packages/brand/theme.css */
@theme {
  --*: initial;

  --spacing: 4px;

  --font-body: Inter, sans-serif;

  --color-lagoon: oklch(0.72 0.11 221.19);
  --color-coral: oklch(0.74 0.17 40.24);
  --color-driftwood: oklch(0.79 0.06 74.59);
  --color-tide: oklch(0.49 0.08 205.88);
  --color-dusk: oklch(0.82 0.15 72.09);
}
```

Then you can use `@import` to include your theme variables in other projects:

```css
/* ./packages/admin/app.css */
@import "tailwindcss";
@import "../brand/theme.css";
```

You can put shared theme variables like this in their own package in monorepo setups or even publish them to NPM and import them just like any other third-party CSS files.

## Common Customization Patterns

### Brand Colors

```css
@theme {
  --color-primary: oklch(0.72 0.11 221.19);
  --color-primary-dark: oklch(0.62 0.11 221.19);
  --color-primary-light: oklch(0.82 0.11 221.19);
  
  --color-secondary: oklch(0.74 0.17 40.24);
  --color-accent: oklch(0.79 0.06 74.59);
  
  --color-success: oklch(0.72 0.22 149.58);
  --color-warning: oklch(0.76 0.18 70.08);
  --color-error: oklch(0.64 0.25 25.33);
}
```

### Typography Scale

```css
@theme {
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;
  --text-6xl: 3.75rem;
  --text-7xl: 4.5rem;
  --text-8xl: 6rem;
  --text-9xl: 8rem;
}
```

### Spacing System

```css
@theme {
  --spacing: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  --spacing-3xl: 4rem;
  --spacing-4xl: 6rem;
  --spacing-5xl: 8rem;
}
```

### Custom Breakpoints

```css
@theme {
  --breakpoint-mobile: 20rem;
  --breakpoint-tablet: 48rem;
  --breakpoint-desktop: 80rem;
  --breakpoint-wide: 120rem;
  --breakpoint-ultra: 160rem;
}
```
