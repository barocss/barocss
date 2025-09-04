# Pseudo-elements

## ::before and ::after

Create pseudo-elements using the `before` and `after` variants:

```html
<div class="relative before:absolute before:inset-0 before:bg-black before:opacity-50 before:rounded-lg">
  <img src="image.jpg" alt="Image with overlay" class="rounded-lg" />
  <div class="absolute inset-0 flex items-center justify-center">
    <h3 class="text-white text-xl font-bold">Overlay Text</h3>
  </div>
</div>
```

## ::placeholder

Style placeholder text in form elements:

```html
<input 
  type="text" 
  placeholder="Enter your name" 
  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-gray-400 placeholder:italic"
/>
```

## ::file

Style file input buttons:

```html
<input 
  type="file" 
  class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
/>
```

## ::marker

Style list markers:

```html
<ul class="list-disc marker:text-red-500 marker:font-bold">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

## ::selection

Style text when it is selected:

```html
<p class="selection:bg-blue-200 selection:text-blue-900">
  Select this text to see the custom selection styling.
</p>
```

## ::first-line and ::first-letter

Style the first line and first letter of text:

```html
<p class="first-line:uppercase first-line:tracking-widest first-letter:text-7xl first-letter:font-bold first-letter:text-slate-900 first-letter:mr-3 first-letter:float-left">
  The first line of this paragraph will be uppercase and have wider letter spacing. The first letter will be large and bold.
</p>
```

## ::backdrop

Style the backdrop of modal dialogs:

```html
<dialog class="backdrop:bg-black backdrop:opacity-50 backdrop:backdrop-blur-sm">
  <div class="bg-white p-6 rounded-lg">
    <h2>Modal Title</h2>
    <p>Modal content goes here.</p>
  </div>
</dialog>
```

## Pseudo-element reference

| Variant | CSS Selector | Description |
|---------|--------------|-------------|
| `before` | `::before` | Creates a pseudo-element before the content |
| `after` | `::after` | Creates a pseudo-element after the content |
| `placeholder` | `::placeholder` | Styles placeholder text |
| `selection` | `::selection` | Styles selected text |
| `file` | `::file-selector-button` | Styles file input buttons |
| `marker` | `::marker` | Styles list markers |
| `backdrop` | `::backdrop` | Styles modal backdrops |
