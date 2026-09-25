---
"@barocss/kit": patch
---

Per-axis `translate-*`, `scale-*` and `rotate-{x,y,z}-*` utilities now use Tailwind 4's composition. Each sets only its own `--baro-*` var, and a shared declaration reads all axes: registered defaults for translate/scale, empty fallbacks for rotate/skew. A lone axis no longer references an undefined variable, and axes combine. Integer `translate-*-N` now uses the spacing scale (previously `N * 100%`). `@property` rules are also hoisted out of media/container variants (`hover:`, `md:` …).
