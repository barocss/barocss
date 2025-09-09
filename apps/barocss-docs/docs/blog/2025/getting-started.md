---
title: Getting Started with BaroCSS
description: A comprehensive guide to setting up BaroCSS in your project and writing your first utility classes.
date: 2025-01-05
author: BaroCSS Team
tags: [tutorial, setup, beginner]
category: tutorials
---

# Getting Started with BaroCSS

**By BaroCSS Team • January 5, 2025 • Tutorials**

This guide will walk you through setting up BaroCSS in your project and writing your first utility classes.

## Installation

### Using npm

```bash
pnpm add @barocss/kit
```

### Using yarn

```bash
yarn add @barocss/kit
```

### Using pnpm

```bash
pnpm add @barocss/kit
```

### Using CDN

```html
<script type="module" src="https://unpkg.com/@barocss/browser/dist/cdn/barocss.js"></script>
```

## Basic Setup

### 1. Import BaroCSS

Create a JavaScript file and import BaroCSS:

```typescript
import { createContext, generateCss } from '@barocss/kit';
```

### 2. Include in Your HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My BaroCSS App</title>
    <link href="styles.css" rel="stylesheet">
</head>
<body>
    <h1 class="text-4xl font-bold text-blue-600">Hello BaroCSS!</h1>
</body>
</html>
```

## Your First Utility Classes

Let's build a simple card component using utility classes:

```html
<div class="max-w-sm mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
    <img class="w-full h-48 object-cover" src="image.jpg" alt="Card image">
    <div class="px-6 py-4">
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Card Title</h2>
        <p class="text-gray-600">This is a simple card built with BaroCSS utility classes.</p>
    </div>
    <div class="px-6 py-4">
        <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Learn More
        </button>
    </div>
</div>
```

## Responsive Design

BaroCSS uses a mobile-first approach. Here's how to make your design responsive:

```html
<div class="w-full md:w-1/2 lg:w-1/3 xl:w-1/4 p-4">
    <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-semibold mb-2">Responsive Card</h3>
        <p class="text-gray-600 text-sm md:text-base">
            This card will be full width on mobile, half width on medium screens,
            one-third width on large screens, and one-quarter width on extra large screens.
        </p>
    </div>
</div>
```

## Dark Mode

BaroCSS includes built-in dark mode support:

```html
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg">
    <h2 class="text-2xl font-bold mb-4">Dark Mode Card</h2>
    <p class="text-gray-600 dark:text-gray-300">
        This card will automatically adapt to dark mode when the user's system
        preference is set to dark mode.
    </p>
</div>
```

## Customization

### Using CSS Variables

You can customize BaroCSS using CSS variables:

```css
```

### Custom Utilities

You can also create your own utility classes using JavaScript:

```typescript
import { staticUtility } from '@barocss/kit';
import { decl } from '@barocss/kit';

staticUtility('text-shadow', [
  decl('text-shadow', '0 2px 4px rgba(0, 0, 0, 0.1)')
]);

staticUtility('glass', [
  decl('background', 'rgba(255, 255, 255, 0.1)'),
  decl('backdrop-filter', 'blur(10px)'),
  decl('border', '1px solid rgba(255, 255, 255, 0.2)')
]);
```

## Common Patterns

### Flexbox Layout

```html
<div class="flex items-center justify-between p-4">
    <h1 class="text-2xl font-bold">Title</h1>
    <button class="bg-blue-500 text-white px-4 py-2 rounded">Action</button>
</div>
```

### Grid Layout

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="bg-white p-6 rounded-lg shadow">Card 1</div>
    <div class="bg-white p-6 rounded-lg shadow">Card 2</div>
    <div class="bg-white p-6 rounded-lg shadow">Card 3</div>
</div>
```

### Form Styling

```html
<form class="max-w-md mx-auto">
    <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="email">
            Email
        </label>
        <input class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
               type="email" id="email" placeholder="Enter your email">
    </div>
    <button class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
        Submit
    </button>
</form>
```

## Resources

- [Documentation](/guide/)
- [GitHub Repository](https://github.com/barocss/barocss)
- [Discord Community](https://discord.gg/barocss)
- [Examples and Templates](https://github.com/barocss/barocss/tree/main/examples)

Happy coding with BaroCSS!
