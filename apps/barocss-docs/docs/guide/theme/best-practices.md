# Theme Variables Best Practices

Guidelines for working with theme variables effectively and maintaining a scalable design system.

## Naming Conventions

### Use Semantic Names

Choose theme variable names that describe purpose, not appearance:

```css
/* Good - semantic naming */
@theme {
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
  --color-danger: oklch(0.64 0.25 25.33);
  --color-success: oklch(0.72 0.22 149.58);
}

/* Avoid - appearance-based naming */
@theme {
  --color-blue: oklch(0.72 0.11 221.19);
  --color-orange: oklch(0.74 0.17 40.24);
  --color-red: oklch(0.64 0.25 25.33);
  --color-green: oklch(0.72 0.22 149.58);
}
```

### Use Consistent Naming Patterns

Follow the same naming pattern across your project:

```css
@theme {
  /* Colors */
  --color-primary: oklch(0.72 0.11 221.19);
  --color-primary-light: oklch(0.82 0.11 221.19);
  --color-primary-dark: oklch(0.62 0.11 221.19);
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Typography */
  --font-body: "Inter", sans-serif;
  --font-heading: "Inter Display", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

### Use Kebab-Case

Always use kebab-case for theme variable names:

```css
/* Good */
--color-brand-primary: oklch(0.72 0.11 221.19);
--font-display-large: "Inter Display", sans-serif;

/* Avoid */
--color-brandPrimary: oklch(0.72 0.11 221.19);
--fontDisplayLarge: "Inter Display", sans-serif;
```

## Color System Design

### Use Consistent Color Scales

For colors, use consistent number scales:

```css
@theme {
  --color-primary-50: oklch(0.98 0.02 221.19);
  --color-primary-100: oklch(0.95 0.05 221.19);
  --color-primary-200: oklch(0.90 0.10 221.19);
  --color-primary-300: oklch(0.82 0.15 221.19);
  --color-primary-400: oklch(0.72 0.20 221.19);
  --color-primary-500: oklch(0.62 0.25 221.19);
  --color-primary-600: oklch(0.52 0.20 221.19);
  --color-primary-700: oklch(0.42 0.15 221.19);
  --color-primary-800: oklch(0.32 0.10 221.19);
  --color-primary-900: oklch(0.22 0.05 221.19);
  --color-primary-950: oklch(0.12 0.02 221.19);
}
```

### Consider Accessibility

Ensure your color choices meet contrast requirements:

```css
@theme {
  /* High contrast colors for accessibility */
  --color-text-primary: oklch(0.15 0.01 0);
  --color-text-secondary: oklch(0.45 0.01 0);
  --color-text-muted: oklch(0.65 0.01 0);
  
  --color-bg-primary: oklch(0.98 0.01 0);
  --color-bg-secondary: oklch(0.95 0.01 0);
  --color-bg-muted: oklch(0.90 0.01 0);
}
```

### Use Modern Color Spaces

Prefer modern color spaces like OKLCH for better color manipulation:

```css
@theme {
  /* Good - OKLCH provides better color manipulation */
  --color-primary: oklch(0.72 0.11 221.19);
  
  /* Avoid - legacy color formats */
  --color-primary: #3b82f6;
}
```

## Typography System

### Create a Consistent Type Scale

Design a consistent typography scale:

```css
@theme {
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */
  --text-6xl: 3.75rem;     /* 60px */
}
```

### Use System Font Stacks

Include system fonts in your font stacks:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Crimson Text", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", monospace;
}
```

## Spacing System

### Use Consistent Spacing Ratios

Create a consistent spacing system:

```css
@theme {
  --spacing: 0.25rem;      /* 4px base unit */
  --spacing-xs: 0.5rem;    /* 8px */
  --spacing-sm: 0.75rem;   /* 12px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */
  --spacing-3xl: 4rem;     /* 64px */
  --spacing-4xl: 6rem;     /* 96px */
  --spacing-5xl: 8rem;     /* 128px */
}
```

## Organization

### Group Related Variables

Keep related theme variables together:

```css
@theme {
  /* Colors */
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
  --color-accent: oklch(0.79 0.06 74.59);
  
  /* Typography */
  --font-body: "Inter", sans-serif;
  --font-heading: "Inter Display", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  
  /* Spacing */
  --spacing: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  
  /* Shadows */
  --shadow-soft: 0 2px 8px rgb(0 0 0 / 0.1);
  --shadow-medium: 0 4px 16px rgb(0 0 0 / 0.15);
  --shadow-strong: 0 8px 32px rgb(0 0 0 / 0.2);
}
```

### Use Comments for Documentation

Document your theme variables:

```css
@theme {
  /* Brand Colors */
  --color-primary: oklch(0.72 0.11 221.19);     /* Main brand color */
  --color-secondary: oklch(0.74 0.17 40.24);    /* Secondary brand color */
  --color-accent: oklch(0.79 0.06 74.59);       /* Accent color for highlights */
  
  /* Semantic Colors */
  --color-success: oklch(0.72 0.22 149.58);     /* Success states */
  --color-warning: oklch(0.76 0.18 70.08);      /* Warning states */
  --color-error: oklch(0.64 0.25 25.33);        /* Error states */
  --color-info: oklch(0.68 0.17 237.32);        /* Info states */
}
```

## Performance Considerations

### Only Include What You Use

By default, Tailwind only generates CSS for theme variables that are actually used. This helps keep your CSS bundle size small.

### Use Static Generation When Needed

If you need all theme variables to be available regardless of usage:

```css
@theme static {
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
}
```

## Testing and Validation

### Test Across Different Contexts

Ensure your theme variables work well in different use cases:

```css
/* Test with different backgrounds */
.bg-white { background-color: var(--color-white); }
.bg-gray-100 { background-color: var(--color-gray-100); }
.bg-gray-900 { background-color: var(--color-gray-900); }

/* Test text contrast */
.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
```

### Validate Color Contrast

Use tools to check that your color combinations meet accessibility standards:

```css
@theme {
  /* Ensure sufficient contrast ratios */
  --color-text-on-primary: oklch(0.98 0.01 0);      /* White text on primary */
  --color-text-on-secondary: oklch(0.98 0.01 0);    /* White text on secondary */
  --color-text-on-light: oklch(0.15 0.01 0);        /* Dark text on light backgrounds */
}
```

## Maintenance

### Version Control Your Theme

Track changes to your theme variables and document breaking changes:

```css
@theme {
  /* v1.0.0 - Initial theme */
  --color-primary: oklch(0.72 0.11 221.19);
  
  /* v1.1.0 - Updated primary color for better accessibility */
  --color-primary: oklch(0.68 0.13 221.19);
  
  /* v2.0.0 - Breaking change: renamed primary to brand */
  --color-brand: oklch(0.68 0.13 221.19);
}
```

### Document Your Decisions

Keep a record of why you chose specific values:

```css
@theme {
  /* Primary color chosen for:
   * - High contrast ratio (4.5:1) on white backgrounds
   * - Good accessibility in both light and dark modes
   * - Brand alignment with company guidelines
   */
  --color-primary: oklch(0.72 0.11 221.19);
}
```

## Sharing and Reusability

### Create Reusable Theme Files

Organize your theme variables into reusable files:

```css
/* ./themes/brand.css */
@theme {
  --color-primary: oklch(0.72 0.11 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
  --font-body: "Inter", sans-serif;
}

/* ./themes/spacing.css */
@theme {
  --spacing: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
}
```

### Use CSS Custom Properties for Runtime Changes

For values that might change at runtime, use CSS custom properties:

```css
:root {
  --current-theme: light;
}

@theme {
  --color-bg: var(--current-theme) == 'light' ? oklch(0.98 0.01 0) : oklch(0.15 0.01 0);
  --color-text: var(--current-theme) == 'light' ? oklch(0.15 0.01 0) : oklch(0.98 0.01 0);
}
```

## Common Pitfalls

### Avoid Over-Specificity

Don't create too many specific theme variables:

```css
/* Avoid - too specific */
@theme {
  --color-button-primary-hover: oklch(0.68 0.13 221.19);
  --color-button-primary-active: oklch(0.64 0.15 221.19);
  --color-button-secondary-hover: oklch(0.72 0.19 40.24);
}

/* Better - use variants instead */
@theme {
  --color-primary: oklch(0.72 0.11 221.19);
  --color-primary-dark: oklch(0.68 0.13 221.19);
  --color-secondary: oklch(0.74 0.17 40.24);
  --color-secondary-dark: oklch(0.72 0.19 40.24);
}
```

### Don't Mix Units

Keep consistent units within the same namespace:

```css
/* Good - consistent units */
@theme {
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
}

/* Avoid - mixed units */
@theme {
  --spacing-xs: 8px;
  --spacing-sm: 0.75rem;
  --spacing-md: 16px;
}
```
