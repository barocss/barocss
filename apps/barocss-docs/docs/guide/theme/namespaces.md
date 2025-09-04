# Theme Variable Namespaces

Theme variables are defined in _namespaces_ and each namespace corresponds to one or more utility class or variant APIs.

Defining new theme variables in these namespaces will make new corresponding utilities and variants available in your project:

## Color Namespace

| Namespace | Utility classes |
|-----------|-----------------|
| `--color-*` | Color utilities like `bg-red-500`, `text-sky-300`, `border-blue-200`, `fill-green-400`, and many more |

The color namespace is one of the most powerful in Tailwind. Any color you define will automatically generate utilities for:

- Background colors: `bg-{name}`
- Text colors: `text-{name}`
- Border colors: `border-{name}`, `border-t-{name}`, `border-r-{name}`, etc.
- Fill colors: `fill-{name}`
- Stroke colors: `stroke-{name}`
- Ring colors: `ring-{name}`
- Outline colors: `outline-{name}`
- Accent colors: `accent-{name}`
- Caret colors: `caret-{name}`
- Decoration colors: `decoration-{name}`
- Divide colors: `divide-{name}`

## Typography Namespaces

| Namespace | Utility classes |
|-----------|-----------------|
| `--font-*` | Font family utilities like `font-sans`, `font-serif`, `font-mono` |
| `--text-*` | Font size utilities like `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` |
| `--font-weight-*` | Font weight utilities like `font-thin`, `font-light`, `font-normal`, `font-bold` |
| `--tracking-*` | Letter spacing utilities like `tracking-tighter`, `tracking-tight`, `tracking-wide` |
| `--leading-*` | Line height utilities like `leading-tight`, `leading-normal`, `leading-loose` |

## Layout Namespaces

| Namespace | Utility classes |
|-----------|-----------------|
| `--breakpoint-*` | Responsive breakpoint variants like `sm:*`, `md:*`, `lg:*`, `xl:*`, `2xl:*` |
| `--container-*` | Container query variants like `@sm:*`, `@md:*` and size utilities like `max-w-md`, `max-w-lg` |
| `--spacing-*` | Spacing and sizing utilities like `p-4`, `m-8`, `w-16`, `h-32`, `max-h-64`, and many more |
| `--radius-*` | Border radius utilities like `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl` |
| `--aspect-*` | Aspect ratio utilities like `aspect-square`, `aspect-video`, `aspect-4/3` |

## Visual Effects Namespaces

| Namespace | Utility classes |
|-----------|-----------------|
| `--shadow-*` | Box shadow utilities like `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` |
| `--inset-shadow-*` | Inset box shadow utilities like `inset-shadow-xs`, `inset-shadow-sm` |
| `--drop-shadow-*` | Drop shadow filter utilities like `drop-shadow-sm`, `drop-shadow-md`, `drop-shadow-lg` |
| `--text-shadow-*` | Text shadow utilities like `text-shadow-sm`, `text-shadow-md`, `text-shadow-lg` |
| `--blur-*` | Blur filter utilities like `blur-sm`, `blur-md`, `blur-lg`, `blur-xl` |
| `--perspective-*` | Perspective utilities like `perspective-near`, `perspective-normal`, `perspective-distant` |

## Animation Namespaces

| Namespace | Utility classes |
|-----------|-----------------|
| `--ease-*` | Transition timing function utilities like `ease-in`, `ease-out`, `ease-in-out` |
| `--animate-*` | Animation utilities like `animate-spin`, `animate-ping`, `animate-pulse`, `animate-bounce` |

## Examples

### Adding a custom color

```css
@theme {
  --color-brand: oklch(0.72 0.11 221.19);
}
```

This creates utilities like:
- `bg-brand`
- `text-brand`
- `border-brand`
- `fill-brand`
- `stroke-brand`
- And many more...

### Adding a custom font

```css
@theme {
  --font-display: "Inter Display", sans-serif;
}
```

This creates the utility:
- `font-display`

### Adding a custom breakpoint

```css
@theme {
  --breakpoint-3xl: 120rem;
}
```

This creates the variant:
- `3xl:*` (e.g., `3xl:grid-cols-6`)

### Adding custom spacing

```css
@theme {
  --spacing-18: 4.5rem;
}
```

This creates utilities like:
- `p-18`, `m-18`
- `w-18`, `h-18`
- `top-18`, `right-18`
- And many more...

## Naming Conventions

When creating custom theme variables, follow these naming conventions:

1. **Use kebab-case**: `--color-brand-primary` not `--color-brandPrimary`
2. **Be descriptive**: `--color-danger` not `--color-red`
3. **Use consistent scales**: For colors, use numbers like `50`, `100`, `200`, etc.
4. **Group related variables**: Keep related variables together in your `@theme` block

## Best Practices

1. **Start with the default theme**: Don't reinvent the wheel - extend the default theme first
2. **Use semantic names**: Choose names that describe purpose, not appearance
3. **Document your choices**: Keep a record of why you chose specific values
4. **Test across contexts**: Ensure your variables work well in different use cases
5. **Consider accessibility**: Make sure your color choices meet contrast requirements
