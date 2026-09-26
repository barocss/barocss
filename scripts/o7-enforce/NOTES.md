# #385 O7 design-system enforcement: classifier vs Tailwind reset + lint

Research scripts only (no product code). Data: `result.json`.

Rerun (repo root, after `pnpm --filter @barocss/kit build:library`):
- L2 classifier: `node scripts/o7-enforce/classify.mjs`
- Baseline: `node scripts/o7-enforce/baseline.mjs`
- L3: `PW_DIR=… CHROME=… node scripts/o7-enforce/run.mjs` (model replies cached in `raw/`, gitignored)

## Method
- **Classifier** (`classify.mjs`): BaroCSS kit `createContext` with each site's theme, then `generateCss` per class.
  unresolved = no CSS. policy = resolved CSS has `position: fixed` or `z-index >= 50` (overlay shape).
  off-token = an arbitrary value, or a `var(--color-*)` the site does not define (shadcn: also radius outside sm..xl).
  Open namespaces (spacing, type, shadow scales) count as the site's own. #253/#255 allow slate because the site shell uses it.
- **Baseline** (`baseline.mjs`): Tailwind 4 `compile` with the site theme after `@theme { --color-*: initial; }`
  (shadcn: also `--radius-*`), plus a lint that rejects `[`. A class is flagged if lint hits, or if it builds normally
  but not after the reset.
- **L3** (`run.mjs`): #253 blocks (the prompt had no tokens) hero and feature-grid, plus the CTA wrapped in a generic
  overlay shape (no recorded output had one). The same model revises, for at most 2 turns. Arm A gets the classifier report
  (class -> kind + nearest site token, or "remove" for policy). Arm B gets the site @theme + the classes the reset drops +
  the lint hits. Arm C gets "Revise the block." Fidelity: rendered in Chromium with the site build, comparing text Jaccard
  and block height with the original.

## L2 (class uses; on / off / unresolved %, policy)
| set | opus | haiku |
|---|---|---|
| #231 json-render | 99.3 / 0.7 / 0, 0 | 100 / 0 / 0, 0 |
| #376 companion | 100 / 0 / 0, 0 | 98.2 / 1.8 / 0, 0 |
| #376 json-render | 99.4 / 0.6 / 0, 0 | 100 / 0 / 0, 0 |
| #376 native | 100 / 0 / 0, 0 | 99.7 / 0 / 0.3, 0 |
| #253 cms (no tokens in prompt) | 83.5 / 16.5 / 0, 0 | 83.1 / 16.9 / 0, 0 |
| #255 cms (tokens in prompt) | 100 / 0 / 0, 0 | 100 / 0 / 0, 0 |

A2UI outputs carry no classes. Off-token classes are almost all default-palette colours: 142 of 145.
In #253, 87 are gray (visually close to the site's slate, low visibility) and about 42 are visibly off-brand
(indigo, blue, green, yellow, purple). There were 3 arbitrary values (`scale-[1.03]`, `after:content-['']`).
Drift tracks the prompt: when the prompt names the tokens (#231, #255, #376), output is on-token for ≥98% of class uses.
**Policy: 0 overlay shapes unprompted** in about 4,700 class uses (no `fixed`, and the only z-index is `z-10`).
Compared with #376 `checkToken` on the shadcn site: the two agree on off-theme colours. The differences come from
checkToken's strict variant, fixed and z allowlist, not from token resolution.

## Baseline vs classifier
- Recorded data: the baseline flags **145/145** off-token uses (reset drop 142, lint 3), with 0 false positives. Both
  miss or silently drop the same unresolved class (`text-destructive-foreground`; Tailwind's normal build drops it too).
- Edge cases: the reset drops `rounded-2xl` and `bg-slate-900/50`, and lint catches `p-[1.75rem]` and `text-[#1f58f5]`
  (an on-brand value written as arbitrary). A typo (`text-primry`) is a silent drop in the baseline; the classifier reports it as unresolved.
  **Overlay:** reset + lint miss `fixed`, `md:fixed` and `z-50`, and catch only `z-[999]` (as an arbitrary value).
  A one-line class regex (as #376's native sketch uses) closes that gap without BaroCSS resolution.

## L3 (N=3 per arm per model; on-token share before -> after, all-on count, turns)
| arm | opus | haiku |
|---|---|---|
| A classifier report | 0.87 -> 1.00, 3/3, 1 turn | 0.83 -> 1.00, 3/3, 1 turn |
| B reset + lint | 0.87 -> 0.99, 2/3, 1 turn | 0.83 -> 0.91, 2/3 |
| C none | 0.87 -> 0.88, 0/3 | 0.83 -> 0.85, 0/3 |

- Palette items (4): A and B **both** reach 100% on-token in 1 turn, with fidelity unchanged (text Jaccard 1.0, height 1.0).
  C does not fix them (haiku feature-grid got worse, 17 -> 27 off).
- The only A-vs-B difference is the overlay item. A removed the overlay 2/2. B removed it 0/2, because the baseline does
  not flag it. C also removed it 2/2, unasked: an out-of-place wrapper invites removal.
  Caveat: the recorded haiku CTA was a text reply, not HTML, so both A and C rewrote it (text Jaccard about 0.04).
- Cost: **$0.468** (17 `claude -p` calls, opus + haiku).

## Verdict
**NO: Tailwind's theme reset + a no-arbitrary lint suffice for design-system tokens.** They catch every off-token class
the classifier found, and their feedback is as effective as the classifier report (A = B on palette drift, 1 turn,
fidelity kept). The policy/overlay gap is real for reset + lint, but it is 0% unprompted in the data, and a trivial class
regex (`fixed`, `z-` ≥ 50) closes it. It is not BaroCSS-owned (AGENTS.md §5 ownership: APP/LIBRARY lint).

## Side notes
- The BaroCSS kit emits nothing for `transform` or `bg-[var(--primary)]`, which Tailwind 4 resolves (a parity gap, not drift).
- Some BaroCSS utilities emit `var(--color-<name>)` where the site defines only the raw var (`ring-ring`, `accent-primary`).
