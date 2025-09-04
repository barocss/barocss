# Background color

Utilities for setting background color.

## Classes

| Utility | Description |
|--------|-------------|
| `bg-{color}` | Set background color using theme colors |
| `bg-{color}-{shade}` | Set background color with shade (e.g., `bg-blue-500`) |
| `bg-transparent` | Transparent background |
| `bg-current` | CurrentColor background |
| `bg-[<any>]` | Arbitrary value, e.g. `bg-[rgb(20,20,20)]` |

## Examples

```html
<div class="bg-blue-500 text-white p-4 rounded">Primary</div>
<div class="bg-slate-100 p-4 rounded">Subtle</div>
<div class="bg-[rgba(0,0,0,0.5)] p-4 text-white">Custom RGBA</div>
```
