# Using Theme Variables

All of your theme variables are turned into regular CSS variables when you compile your CSS:

```css
:root {

  --color-red-50: oklch(0.971 0.013 17.38);
  --color-red-100: oklch(0.936 0.032 17.717);
  --color-red-200: oklch(0.885 0.062 18.334);
  /* ... */

  --shadow-2xs: 0 1px rgb(0 0 0 / 0.05);
  /* ... */
```

This makes it easy to reference all of your design tokens in any of your custom CSS or inline styles.

## With Custom CSS

Use your theme variables to get access to your design tokens when you're writing custom CSS that needs to use the same values:

```css
.typography {
  p {
    font-size: var(--text-base);
    color: var(--color-gray-700);
  }

  h1 {
    font-size: var(--text-2xl--line-height);
    font-weight: var(--font-weight-semibold);
    color: var(--color-gray-950);
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-gray-950);
  }
```

This is often useful when styling HTML you don't control, like Markdown content coming from a database or API and rendered to HTML.

### Component Styling

```css
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  background-color: var(--color-primary);
  color: var(--color-white);
  
.btn:hover {
  background-color: var(--color-primary-dark);
  
.card {
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-6);
```

### Third-party Library Overrides

```css
.select2-dropdown {
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  background-color: var(--color-white);
  border: 1px solid var(--color-gray-300);

.select2-search {
  border-radius: 0.375rem;
  border: 1px solid var(--color-gray-300);
  background-color: var(--color-gray-50);

.select2-results__group {
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--color-gray-900);
```

## With Arbitrary Values

Using theme variables in arbitrary values can be useful, especially in combination with the `calc()` function.

### Basic Usage

```html
<div class="relative rounded-xl">
  <div class="absolute inset-px rounded-[calc(var(--radius-xl)-1px)]">
    <!-- ... -->
  </div>
  <!-- ... -->
</div>
```

In the above example, we're subtracting 1px from the `--radius-xl` value on a nested inset element to make sure it has a concentric border radius.

### Complex Calculations

```html
<div class="w-[calc(var(--spacing)*16)] h-[calc(var(--spacing)*20)]">
  <!-- 16 * 0.25rem = 4rem width, 20 * 0.25rem = 5rem height -->
</div>
```

### Color Manipulation

```html
<div class="bg-[color-mix(in_oklab,var(--color-blue-500)_50%,transparent)]">
  <!-- 50% transparent blue -->
</div>
```

### Spacing Combinations

```html
<div class="p-[calc(var(--spacing-4)+var(--spacing-2))]">
  <!-- padding: 1.5rem (1rem + 0.5rem) -->
</div>
```

## With Inline Styles

You can use theme variables directly in inline styles:

```html
<div style="background-color: var(--color-primary); color: var(--color-white);">
  Primary colored element
</div>

<div style="font-family: var(--font-display); font-size: var(--text-2xl);">
  Custom typography
</div>

<div style="box-shadow: var(--shadow-lg); border-radius: var(--radius-xl);">
  Custom shadow and radius
</div>
```

## Referencing in JavaScript

Most of the time when you need to reference your theme variables in JS you can just use the CSS variables directly, just like any other CSS value.

### With Animation Libraries

For example, the popular [Motion](https://motion.dev/guide/react-installation) library for React lets you animate to and from CSS variable values:

```jsx
import { motion } from "framer-motion";

function AnimatedComponent() {
  return (
    <motion.div 
      animate={{ 
        backgroundColor: "var(--color-blue-500)",
        scale: 1.1 
      }}
      whileHover={{ 
        backgroundColor: "var(--color-blue-600)" 
      }}
    >
      Animated with theme colors
    </motion.div>
  );
```

### With CSS-in-JS

```jsx
import styled from 'styled-components';

const StyledButton = styled.button`
  background-color: var(--color-primary);
  color: var(--color-white);
  padding: var(--spacing-4) var(--spacing-6);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  
  &:hover {
    background-color: var(--color-primary-dark);
  }
`;
```

### Getting Computed Values

If you need access to a resolved CSS variable value in JS, you can use `getComputedStyle` to get the value of a theme variable on the document root:

```js
// Get a single theme variable value
let styles = getComputedStyle(document.documentElement);
let primaryColor = styles.getPropertyValue("--color-primary");
let shadowValue = styles.getPropertyValue("--shadow-lg");

console.log(primaryColor); // "oklch(0.72 0.11 221.19)"
console.log(shadowValue);  // "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
```

### Getting Multiple Values

```js
function getThemeValues() {
  const styles = getComputedStyle(document.documentElement);
  const theme = {};
  
  // Get all CSS custom properties
  for (let i = 0; i < styles.length; i++) {
    const property = styles[i];
    if (property.startsWith('--')) {
      theme[property] = styles.getPropertyValue(property);
    }
  }
  
  return theme;

const themeValues = getThemeValues();
console.log(themeValues['--color-primary']); // "oklch(0.72 0.11 221.19)"
```

### Dynamic Theme Switching

```js
function switchTheme(themeName) {
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark', 'theme-custom');
  
  // Add new theme class
  root.classList.add(`theme-${themeName}`);
  
  // Update CSS custom properties
  if (themeName === 'dark') {
    root.style.setProperty('--color-primary', 'var(--color-blue-400)');
    root.style.setProperty('--color-background', 'var(--color-gray-900)');
  } else {
    root.style.setProperty('--color-primary', 'var(--color-blue-600)');
    root.style.setProperty('--color-background', 'var(--color-white)');
  }
```

