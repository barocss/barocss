---
"@barocss/kit": minor
---

Default theme data now matches Tailwind CSS 4.3 (`tailwindcss/theme.css` 4.3.3) (#307).

Default values that change for existing users:
- `font-sans` (and the preflight `html` font fallback) is now `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'` (was `ui-sans-serif, system-ui, sans-serif, …`). `font-serif` and `font-mono` are unchanged.
- `neutral-50…950` and `zinc-50` use hue `none` (`oklch(55.6% 0 none)` instead of `oklch(55.6% 0 0)`). Rendered colours are the same.

Added:
- The `mauve`, `olive`, `mist` and `taupe` palettes (50–950) for every colour utility.
- `placeholder-<color>` utilities (`.placeholder-red-500::placeholder { color: var(--color-red-500) }`, with `/alpha`, arbitrary colours, custom properties, `inherit`/`current`/`transparent`), as in Tailwind 4.3.

No other theme keys (spacing, radius, shadows, etc.) differ between Tailwind 4.1.13 and 4.3.3.
