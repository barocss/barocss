# Styling with utility classes

BaroCSS generates CSS at runtime when utility classes appear in the DOM.

```html
<div class="p-4 bg-blue-500 text-white rounded-lg">Hello</div>
```

- Classes map directly to CSS rules.
- Only classes present in the DOM are generated.

## Composition

```html
<button class="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white">Click</button>
```

## Arbitrary values

```html
<div class="w-[42px] h-[2.75rem] bg-[rgb(20,20,20)]"></div>
```
