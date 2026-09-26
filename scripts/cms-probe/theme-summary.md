# #255 custom site theme in companion mode (2026-09-26)

Rerun: see the header of `theme-run.mjs` (blocks: `bash scripts/cms-probe/theme-generate.sh`, cost $0.25 for 12 blocks;
haiku needed "reply with only the HTML" and one callout retry because it first asked questions instead of writing HTML).

Site: #253 shell with its own tokens `--color-brand-50..900`, `--color-accent`, `--font-display`, `--spacing-gutter`, `--radius-card`.
Blocks: 6 per model (opus, haiku), 197 block elements, 107 distinct classes, 31 theme-token classes (all resolve in the reference build).
Metrics: tok = theme-token classes whose isolated computed style equals the reference; elem = block element parity; dmg = shell/prose
elements changed (ignoring width/height reflow), out of 66 (33 x 2 models). One run (all arms deterministic).

| variant | build | twb | baro0 (#242, no theme) | baroVar (extend -> var(--color-*)) | baroLit (extend with literals) |
|---|---|---|---|---|---|
| `@theme` | 0.39 · 0.10 · 0 | 1.00 · 1.00 · 8 | 0.39 · 0.20 · 0 | 0.13 · 0.04 · **36** | 0.84 · 0.31 · 0 |
| `@theme inline` | 0.39 · 0.10 · 0 | 1.00 · 1.00 · 8 | 0.39 · 0.20 · 0 | 0.39 · 0.20 · 0 | 0.84 · 0.31 · 0 |
| `@theme static` | 0.39 · 0.10 · 0 | 1.00 · 1.00 · 8 | 0.39 · 0.20 · 0 | 0.13 · 0.04 · **36** | 0.84 · 0.31 · 0 |

(build/baro0 0.39 = the token classes the shell already compiled.)

Findings
- Route (a) var references is harmful: BaroCSS always emits `bg-brand-600 { background-color: var(--color-brand-600) }` and writes
  the theme value into `:root,:host`, so `--color-brand-600: var(--color-brand-600)` is a cyclic var that overrides the build's value:
  site colours on 36 shell elements break. Under `@theme inline` there are no vars, so it is a no-op.
- Route (b) literal values is the smallest working route for all three variants: colours, accent, font-display and rounded-card
  resolve (26/31), zero damage.
- Route (c): nothing exists (no reading of CSS vars / `@theme` at start).
- Remaining gap in every variant: named spacing tokens. `p-gutter`, `px-/py-/mt-/mb-/gap-gutter` (5 classes, ~70 uses, mostly on
  block containers, hence elem 0.31) produce no rule even with `theme.extend.spacing.gutter`: the spacing utilities
  (`packages/barocss/src/presets/spacing.ts`) accept only numbers/arbitrary/custom-property, never a `theme.spacing` key.
- @tailwindcss/browser resolves everything (8 shell elements changed by its preflight re-injection, as in #253).
