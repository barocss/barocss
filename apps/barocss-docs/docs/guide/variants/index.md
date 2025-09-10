# Hover, focus, and other states

Using utilities to style elements on hover, focus, and more.

Every utility class in Tailwind can be applied _conditionally_ by adding a variant to the beginning of the class name that describes the condition you want to target.

For example, to apply the `bg-sky-700` class on hover, use the `hover:bg-sky-700` class:

Hover over this button to see the background color change

Save changes

```html
<button class="bg-sky-500 hover:bg-sky-700 ...">Save changes</button>
```

How does this compare to traditional CSS?

When writing CSS the traditional way, a single class name would do different things based on the current state:

Traditionally the same class name applies different styles on hover

```css
.btn-primary {
  background-color: #0ea5e9;
.btn-primary:hover {
  background-color: #0369a1;
```

In Tailwind, rather than adding the styles for a hover state to an existing class, you add another class to the element that _only_ does something on hover:

In Tailwind, separate classes are used for the default state and the hover state

```css
.bg-sky-500 {
  background-color: #0ea5e9;
.hover\:bg-sky-700:hover {
  background-color: #0369a1;
```

Notice how `hover:bg-sky-700` _only_ defines styles for the `:hover` state? It does nothing by default, but as soon as you hover over an element with that class, the background color will change to `sky-700`.

This is what we mean when we say a utility class can be applied _conditionally_ — by using variants you can control exactly how your design behaves in different states, without ever leaving your HTML.

Tailwind includes variants for just about everything you'll ever need, including:

- [Pseudo-classes](./pseudo-classes.md), like `:hover`, `:focus`, `:first-child`, and `:required`
- [Pseudo-elements](./pseudo-elements.md), like `::before`, `::after`, `::placeholder`, and `::selection`
- [Media and feature queries](./media-queries.md), like responsive breakpoints, dark mode, and `prefers-reduced-motion`
- [Attribute selectors](./attribute-selectors.md), like `[dir="rtl"]` and `[open]`
- [Child selectors](./child-selectors.md), like `& > *` and `& *`

These variants can even be stacked to target more specific situations, for example changing the background color in dark mode, at the medium breakpoint, on hover:

```html
<button class="dark:md:hover:bg-fuchsia-600 ...">Save changes</button>
```

In this guide you'll learn about every variant available in the framework, how to use them with your own custom classes, and even how to create your own.

## Quick reference

Here's a quick reference of the most commonly used variants:

| Variant | Description | Example |
|---------|-------------|---------|
| `hover:` | On hover | `hover:bg-blue-500` |
| `focus:` | On focus | `focus:ring-2` |
| `active:` | On active | `active:scale-95` |
| `disabled:` | When disabled | `disabled:opacity-50` |
| `dark:` | In dark mode | `dark:bg-gray-800` |
| `sm:` | Small screens+ | `sm:text-lg` |
| `md:` | Medium screens+ | `md:flex` |
| `lg:` | Large screens+ | `lg:grid-cols-3` |
| `first:` | First child | `first:pt-0` |
| `last:` | Last child | `last:pb-0` |
| `odd:` | Odd children | `odd:bg-gray-50` |
| `even:` | Even children | `even:bg-white` |
