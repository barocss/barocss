---
"@barocss/kit": patch
---

Match Tailwind 4.3.3 shadows: add `text-shadow-*` (2xs–lg sizes, colours, `/N`, `/[x%]`, `/(--o)`, `none`, arbitrary and custom-property values) with the `--text-shadow-*` theme scale; `drop-shadow-*` sizes now use Tailwind's theme values with colour and opacity modifiers; named `shadow-*`/`inset-shadow-*` wrap their colour in `--baro-shadow-color` so `shadow-md shadow-red-500/20` composes; `shadow-inner` and bare `shadow/N` work; `/[x%]` and `/(--o)` opacity on named shadows.
