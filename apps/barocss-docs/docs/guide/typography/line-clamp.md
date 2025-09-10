# line-clamp

Utilities for clamping text to a specific number of lines.

## Quick reference

| Class | Styles |
|-------|--------|
| `line-clamp-1` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1;` |
| `line-clamp-2` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;` |
| `line-clamp-3` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;` |
| `line-clamp-4` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4;` |
| `line-clamp-5` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5;` |
| `line-clamp-6` | `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 6;` |
| `line-clamp-none` | `overflow: visible; display: block; -webkit-box-orient: horizontal; -webkit-line-clamp: none;` |

## Examples

### Basic example

Use utilities like `line-clamp-1` and `line-clamp-3` to clamp text to a specific number of lines:

```html
<p class="line-clamp-1 ...">
  Et molestiae hic earum repellat aliquid est doloribus delectus. Enim illum odit porro ut omnis dolor debitis natus. Voluptas possimus deserunt sit delectus est saepe nihil. Qui voluptate possimus et quia. Eligendi voluptas dolor qui laboriosam.
</p>
<p class="line-clamp-3 ...">
  Et molestiae hic earum repellat aliquid est doloribus delectus. Enim illum odit porro ut omnis dolor debitis natus. Voluptas possimus deserunt sit delectus est saepe nihil. Qui voluptate possimus et quia. Eligendi voluptas dolor qui laboriosam.
</p>
```

### Removing line clamp

Use the `line-clamp-none` utility to remove line clamping:

```html
<p class="line-clamp-3 md:line-clamp-none ...">
  Et molestiae hic earum repellat aliquid est doloribus delectus. Enim illum odit porro ut omnis dolor debitis natus. Voluptas possimus deserunt sit delectus est saepe nihil. Qui voluptate possimus et quia. Eligendi voluptas dolor qui laboriosam.
</p>
```

### Responsive design

Prefix a `line-clamp` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="line-clamp-2 md:line-clamp-4 ...">Lorem ipsum dolor sit amet...</p>
```



