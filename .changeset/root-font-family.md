---
"@barocss/kit": patch
"@barocss/browser": patch
---

Preflight ('standard' and 'full') now sets the root font family, feature and variation settings, and gives code/kbd/samp/pre the monospace stack, matching Tailwind 4.1.13. The app's `--default-font-family` / `--font-sans` still take precedence. `font-sans`, `font-serif` and `font-mono` now reference the theme vars that are actually defined (`--font-sans|serif|mono`).
