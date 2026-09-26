---
"@barocss/kit": patch
---

Opacity modifiers on arbitrary and custom-property colours now match Tailwind 4.3.3: `bg-[#f00]/50` emits `color-mix(in oklab, #f00 50%, transparent)`, and `bg-[var(--x)]/50`, `bg-(--x)/50` and `bg-(color:--x)/50` keep the plain colour plus an `@supports` color-mix (previously the opacity was ignored, or `bg-(--x)/50` emitted a broken value). This applies to every colour utility (text, border, ring, inset-ring, outline, decoration, divide, placeholder, accent, caret, fill, stroke, gradient stops). Bracketed modifiers (`/[0.3]`, `/[50%]`) and variable modifiers (`/(--o)`) work too. Theme colours with opacity on ring, inset-ring, accent, caret, fill and stroke now use the same form as `bg-*`. A modifier that can't be applied (a non-colour value, an empty or malformed modifier) emits nothing.
