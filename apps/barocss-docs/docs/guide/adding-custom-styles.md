# Adding custom styles

Best practices for adding your own custom styles in BaroCSS projects.

Often the biggest challenge when working with a framework is figuring out what you're supposed to do when there's something you need that the framework doesn't handle for you.

BaroCSS has been designed from the ground up to be extensible and customizable, so that no matter what you're building you never feel like you're fighting the framework.

This guide covers topics like customizing your design tokens, how to break out of those constraints when necessary, adding your own custom CSS, and extending the framework with plugins.

## Customizing your theme

If you want to change things like your color palette, spacing scale, typography scale, or breakpoints, add your customizations using the theme configuration in your BaroCSS setup:

```typescript
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        fontFamily: {
          display: ['Satoshi', 'sans-serif']
        },
        screens: {
          '3xl': '120rem'
        },
        colors: {
          avocado: {
            100: '#f0fdf4',
            200: '#dcfce7',
            300: '#bbf7d0',
            400: '#86efac',
            500: '#4ade80',
            600: '#22c55e'
          }
        },
        transitionTimingFunction: {
          fluid: 'cubic-bezier(0.3, 0, 0, 1)',
          snappy: 'cubic-bezier(0.2, 0, 0, 1)'
        }
      }
    }
  }
});
```

Learn more about customizing your theme in the theme variables documentation.

## Using arbitrary values

While you can usually build the bulk of a well-crafted design using a constrained set of design tokens, once in a while you need to break out of those constraints to get things pixel-perfect.

When you find yourself really needing something like `top: 117px` to get a background image in just the right spot, use Tailwind's square bracket notation to generate a class on the fly with any arbitrary value:

```html
<div class="top-[117px]">
  <!-- ... -->
</div>
```

This is basically like inline styles, with the major benefit that you can combine it with interactive modifiers like `hover` and responsive modifiers like `lg`:

```html
<div class="top-[117px] lg:top-[344px]">
  <!-- ... -->
</div>
```

This works for everything in the framework, including things like background colors, font sizes, pseudo-element content, and more:

```html
<div class="bg-[#bada55] text-[22px] before:content-['Festivus']">
  <!-- ... -->
</div>
```

If you're referencing a CSS variable as an arbitrary value, you can use the custom property syntax:

```html
<div class="fill-(--my-brand-color) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `fill-[var(--my-brand-color)]` that adds the `var()` function for you automatically.

### Arbitrary properties

If you ever need to use a CSS property that Tailwind doesn't include a utility for out of the box, you can also use square bracket notation to write completely arbitrary CSS:

```html
<div class="[mask-type:luminance]">
  <!-- ... -->
</div>
```

This is _really_ like inline styles, but again with the benefit that you can use modifiers:

```html
<div class="[mask-type:luminance] hover:[mask-type:alpha]">
  <!-- ... -->
</div>
```

This can be useful for things like CSS variables as well, especially when they need to change under different conditions:

```html
<div class="[--scroll-offset:56px] lg:[--scroll-offset:44px]">
  <!-- ... -->
</div>
```

### Arbitrary variants

Arbitrary _variants_ are like arbitrary values but for doing on-the-fly selector modification, like you can with built-in pseudo-class variants like `hover:{utility}` or responsive variants like `md:{utility}` but using square bracket notation directly in your HTML.

```html
<ul role="list">
  {#each items as item}
  <li class="lg:[&:nth-child(-n+3)]:hover:underline">{item}</li>
  {/each}
</ul>
```

Learn more in the arbitrary variants documentation.

### Handling whitespace

When an arbitrary value needs to contain a space, use an underscore (`_`) instead and Tailwind will automatically convert it to a space at build-time:

```html
<div class="grid grid-cols-[1fr_500px_2fr]">
  <!-- ... -->
</div>
```

In situations where underscores are meaningful (like in CSS custom property names), you can escape them with a backslash:

```html
<div class="bg-[var(--my-color_1)]">
  <!-- ... -->
</div>
```

### Resolving ambiguities

When Tailwind can't tell which utility you're trying to use, you can be more explicit by prefixing the arbitrary value with the utility type:

```html
<div class="[color:red]">
  <!-- ... -->
</div>
```

## Using custom CSS

### Adding base styles

Use the `@layer base` directive to add base styles to your project. Base styles are things like setting font families on the `html` element, setting default link styles, and so on.

```css
@layer base {
  html {
    font-family: "Inter", sans-serif;
  }
  
  a {
    @apply text-blue-600 underline;
  }
  
  a:hover {
    @apply text-blue-800;
  }
}
```

### Adding component classes

Use the `@layer components` directive to add more complex, reusable component classes to your project:

```css
@layer components {
  .btn-primary {
    @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
  }
  
  .btn-secondary {
    @apply bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded;
  }
}
```

You can now use these component classes in your HTML:

```html
<button class="btn-primary">Primary Button</button>
<button class="btn-secondary">Secondary Button</button>
```

Component classes are a great way to organize styles that are used together frequently, but remember that you probably don't need these types of classes as often as you think. Read our guide on managing duplication for our recommendations.

The `components` layer is also a good place to put custom styles for any third-party components you're using:

```css
@layer components {
  .select2-dropdown {
    /* ... */
  }
}
```

### Using variants

Use the `@variant` directive to apply a Tailwind variant within custom CSS:

```css
.my-element {
  background: white;
  @variant dark {
    background: black;
  }
}
```

Compiled CSS:

```css
.my-element {
  background: white;
  @media (prefers-color-scheme: dark) {
    background: black;
  }
}
```

If you need to apply multiple variants at the same time, use nesting:

```css
.my-element {
  background: white;
  @variant dark {
    @variant hover {
      background: black;
    }
  }
}
```

Compiled CSS:

```css
.my-element {
  background: white;
  @media (prefers-color-scheme: dark) {
    &:hover {
      @media (hover: hover) {
        background: black;
      }
    }
  }
}
```

## Adding custom utilities

### Simple utilities

In addition to using the utilities that ship with Tailwind, you can also add your own custom utilities. This can be useful when there's a CSS feature you'd like to use in your project that Tailwind doesn't include utilities for out of the box.

Use the `@utility` directive to add a custom utility to your project:

```css
@utility content-auto {
  content-visibility: auto;
}
```

You can now use this utility in your HTML:

```html
<div class="content-auto">
  <!-- ... -->
</div>
```

It will also work with variants like `hover`, `focus` and `lg`:

```html
<div class="hover:content-auto">
  <!-- ... -->
</div>
```

Custom utilities are automatically inserted into the `utilities` layer along with all of the built-in utilities in the framework.

### Complex utilities

If your custom utility is more complex than a single class name, use nesting to define the utility:

```css
@utility scrollbar-hidden {
  &::-webkit-scrollbar {
    display: none;
  }
}
```

### Functional utilities

In addition to registering simple utilities with the `@utility` directive, you can also register functional utilities that accept an argument:

```css
@utility tab-* {
  tab-size: --value(--tab-size-*);
}
```

The special `--value()` function is used to resolve the utility value.

#### Matching theme values

Use the `--value(--theme-key-*)` syntax to resolve the utility value against a set of theme keys:

```css
@theme {
  --tab-size-2: 2;
  --tab-size-4: 4;
  --tab-size-github: 8;
}

@utility tab-* {
  tab-size: --value(--tab-size-*);
}
```

This will match utilities like `tab-2`, `tab-4`, and `tab-github`.

#### Bare values

To resolve the value as a bare value, use the `--value({type})` syntax, where `{type}` is the data type you want to validate the bare value as:

```css
@utility tab-* {
  tab-size: --value(integer);
}
```

This will match utilities like `tab-1` and `tab-76`.

#### Literal values

To support literal values, use the `--value('literal')` syntax (notice the quotes):

```css
@utility tab-* {
  tab-size: --value("inherit", "initial", "unset");
}
```

This will match utilities like `tab-inherit`, `tab-initial`, and `tab-unset`.

#### Arbitrary values

To support arbitrary values, use the `--value([{type}])` syntax (notice the square brackets) to tell Tailwind which types are supported as an arbitrary value:

```css
@utility tab-* {
  tab-size: --value([integer]);
}
```

This will match utilities like `tab-[1]` and `tab-[76]`. If you want to support any data type, you can use `--value([*])`.

#### Supporting theme, bare, and arbitrary values together

All three forms of the `--value()` function can be used within a rule as multiple declarations, and any declarations that fail to resolve will be omitted in the output:

```css
@theme {
  --tab-size-github: 8;
}

@utility tab-* {
  tab-size: --value([integer]);
  tab-size: --value(integer);
  tab-size: --value(--tab-size-*);
}
```

This makes it possible to treat the value differently in each case if necessary, for example translating a bare integer to a percentage:

```css
@utility opacity-* {
  opacity: --value([percentage]);
  opacity: calc(--value(integer) * 1%);
  opacity: --value(--opacity-*);
}
```

The `--value()` function can also take multiple arguments and resolve them left to right if you don't need to treat the return value differently in different cases:

```css
@theme {
  --tab-size-github: 8;
}

@utility tab-* {
  tab-size: --value(--tab-size-*, integer, [integer]);
}

@utility opacity-* {
  opacity: calc(--value(integer) * 1%);
  opacity: --value(--opacity-*, [percentage]);
}
```

#### Negative values

To support negative values, register separate positive and negative utilities into separate declarations:

```css
@utility inset-* {
  inset: --spacing(--value(integer));
  inset: --value([percentage], [length]);
}

@utility -inset-* {
  inset: --spacing(--value(integer) * -1);
  inset: calc(--value([percentage], [length]) * -1);
}
```

#### Modifiers

Modifiers are handled using the `--modifier()` function which works exactly like the `--value()` function but operates on a modifier if present:

```css
@utility text-* {
  font-size: --value(--text-*, [length]);
  line-height: --modifier(--leading-*, [length], [*]);
}
```

If a modifier isn't present, any declaration depending on a modifier is just not included in the output.

#### Fractions

To handle fractions, we rely on the CSS `ratio` data type. If this is used with `--value()`, it's a signal to Tailwind to treat the value and modifier as a single value:

```css
@utility aspect-* {
  aspect-ratio: --value(--aspect-ratio-*, ratio, [ratio]);
}
```

This will match utilities like `aspect-square`, `aspect-3/4`, and `aspect-[7/9]`.

## Adding custom variants

In addition to using the variants that ship with Tailwind, you can also add your own custom variants using the `@custom-variant` directive:

```css
@custom-variant theme-midnight {
  &:where([data-theme="midnight"] *) {
    @slot;
  }
}
```

Now you can use the `theme-midnight:<utility>` variant in your HTML:

```html
<html data-theme="midnight">
  <button class="theme-midnight:bg-black ..."></button>
</html>
```

You can create variants using the shorthand syntax when nesting isn't required:

```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

When a custom variant has multiple rules, they can be nested within each other:

```css
@custom-variant any-hover {
  @media (any-hover: hover) {
    &:hover {
      @slot;
    }
  }
}
```
