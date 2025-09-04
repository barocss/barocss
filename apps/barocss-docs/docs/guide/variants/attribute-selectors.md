# Attribute selectors

## ARIA states

Use the `aria-*` variants to apply styles based on ARIA attributes:

```html
<button aria-expanded="false" class="aria-expanded:bg-blue-500 aria-expanded:text-white">
  Toggle
</button>
```

## Data attributes

Use arbitrary attribute selectors to target custom data attributes:

```html
<div data-state="active" class="[&[data-state=active]]:bg-blue-500 [&[data-state=active]]:text-white">
  This div changes style based on its data-state attribute.
</div>
```

## RTL support

Use the `rtl` and `ltr` variants to apply styles based on text direction:

```html
<div class="text-left ltr:text-left rtl:text-right">
  This text aligns differently based on direction.
</div>
```

## Open/closed state

Use the `open` variant to style elements when they are open:

```html
<details class="border border-gray-200 rounded-lg open:border-blue-300 open:bg-blue-50">
  <summary class="p-4 cursor-pointer">Click to expand</summary>
  <div class="p-4 border-t border-gray-200">
    This content is shown when the details element is open.
  </div>
</details>
```

## Styling inert elements

Use the `inert` variant to style elements when they are inert:

```html
<div class="inert:opacity-50 inert:pointer-events-none">
  This div becomes semi-transparent and non-interactive when inert.
</div>
```

## Attribute selector reference

| Variant | CSS Selector | Description |
|---------|--------------|-------------|
| `rtl` | `[dir="rtl"]` | Right-to-left text direction |
| `ltr` | `[dir="ltr"]` | Left-to-right text direction |
| `open` | `[open]` | Open state (details, dialog, etc.) |
