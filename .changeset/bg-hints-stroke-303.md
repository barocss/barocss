---
"@barocss/kit": patch
---

Background type hints and arbitrary stroke widths match Tailwind (#303). `bg-(position:--x)`, `bg-(size:--x)`, `bg-(image:--x)` (and `percentage` / `length` / `url` hints, plus the bracket forms such as `bg-[position:var(--x)]`) now emit `background-position` / `background-size` / `background-image` instead of a broken `background-color`. `stroke-[1.5px]`, `stroke-[50%]`, `stroke-[calc(…)]`, `stroke-[length:var(--x)]` and `stroke-(number:--x)` now emit `stroke-width`. Untyped `bg-(--x)` and `stroke-[<colour>]` stay colours.
