---
"@barocss/kit": patch
---

Border family matches Tailwind 4.3.3 (#344). **Behaviour change visible in RTL:** `border-x-*` / `border-y-*` now emit the logical `border-inline-*` / `border-block-*` properties (width and colour) instead of physical left/right and top/bottom, so in `dir="rtl"` or vertical writing modes they follow the writing direction as Tailwind does. `divide-x-<colour>` / `divide-y-<colour>` no longer emit a colour rule (Tailwind emits nothing; use `divide-<colour>`), and `divide-x-(--w)` is a width. Custom `borderWidth` theme keys now reference `var(--border-width-<key>)`, declared on `:root`, so runtime theme overrides reach them. `border-x-3` (a bare number on a side root) now sets only that side's width.
