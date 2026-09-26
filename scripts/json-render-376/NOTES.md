# #376: json-render / A2UI vs BaroCSS companion vs a BaroCSS-native sketch

Research only. The native spec and its renderer (`native.mjs`, `h()` in `page.js`) are throwaway code and never go into packages.

## Setup (human-approved downloads; scratch only, repo deps and lockfile untouched)
- `scratch/jr`: `@json-render/core@0.21.0` and `@json-render/react@0.21.0` (repo vercel-labs/json-render, homepage json-render.dev), plus `react@19` and `react-dom@19`.
- `scratch/a2`: `@a2ui/react@0.11.1`, which pulls in `@a2ui/web_core@0.11.0` and `@a2ui/markdown-it` (repo a2ui-project/a2ui, homepage a2ui.org, Google's A2UI), plus `react@19` and `react-dom@19`. The renderer is the v0.9 protocol with `basicCatalog`.
- Install: `cd scripts/json-render-376/scratch/{jr,a2} && npm i --cache <worktree>/.npm-cache <pkgs>` (each dir has its own `package.json`, see above). `scratch/` is gitignored.
- Generate (run once; outputs are frozen): `node scripts/json-render-376/gen.mjs`. This makes 48 `claude -p` calls (6 requests × 4 formats × opus/haiku) with `--system-prompt` = the format prompt (`prompts.json`). The json-render system prompt is the official `catalog.prompt()` (JSONL SpecStream patches) plus one theme rule. **Model cost: $1.84.**
- Measure: `PW_DIR=... CHROME=... [PROBE_PORT=7400] node scripts/json-render-376/run.mjs` writes `result.json`.

## Formats
1. **json-render**: a shadcn-style catalog (`jr-catalog.mjs`, the #231 component set). `className` is allowed on Card, Stack, Grid, Text and Button. It renders with the official `Renderer`, `StateProvider` and `compileSpecStream`.
2. **A2UI**: v0.9 JSONL messages rendered with the official `A2uiSurface` and `MessageProcessor`. A2UI has no style or className props. Its CSS variables are mapped onto the host theme (`A2MAP`), which is the most an integrator can do.
3. **companion**: a free HTML fragment with utility classes, inserted with `innerHTML`.
4. **native sketch**: a JSON tree `{el, class, text, attrs, children}`. Element and attribute allowlists apply. Every class token is resolved by BaroCSS (`parseClassToAst`) against the theme. Tokens are dropped if they are unresolved, off-theme (the value resolves to a default-palette `--color-*` variable instead of a theme variable), arbitrary (`[...]`), `fixed`/`z-*`, or use a disallowed variant.

All formats get the same CSS: Tailwind 4 `compile()` over every token seen, plus `theme.css` (shadcn tokens with a violet primary).

## Measures (per output, Chromium at 1280px)
- structural: request-specific checklist (values, controls, buttons, text). The reference scores 1.0 on all 6.
- visual: primary CTA uses the theme primary; a bordered or shadowed rounded surface; type hierarchy; a request layout check (tiers side by side, bar filled with primary, header cells in one row with ≥2 badge colours, centred heading, Save/Cancel on one row, a centred ≥40px hero headline); share of computed colours that are on-theme. The reference scores 0.99 to 1.0.
- expressible: share of requests where at least one model reached structural ≥ 0.8 and the layout check passed.
- error: the output fails to parse, validate or render, or shows no content. off-theme: share of class tokens that are off-theme or arbitrary (BaroCSS `checkToken`).
- stream: visible text of the 25/50/75% character prefixes, relative to the full render, using each format's own incremental path (SpecStream, JSONL messages, HTML parser, lenient JSON for the native tree).
- safety: unsafe constructs in the model outputs (none in any format), plus one adversarial fixture per format with generic shapes: an `onerror` handler, a `javascript:` link, a `<style>` breakout, a `fixed inset-0 z-50` overlay, a url() arbitrary class, a cross-origin image, a `[body_&]` variant, and an unknown component.

## Results (`result.json`)
| format | model | structural | visual | expressible | error | off-theme (tokens) | stream | 25% prefix renders |
|---|---|---|---|---|---|---|---|---|
| json-render | opus | 1.00 | 0.96 | 0.83 | 0 | 0.01 (157) | 0.34 | 0.50 |
| json-render | haiku | 1.00 | 0.90 | 0.67 | 0 | 0.00 (140) | 0.38 | 0.50 |
| A2UI | opus | 0.57 | 0.35 | 0.17 | 0.50 | n/a (0) | 0.62 | 1.00 |
| A2UI | haiku | 0.80 | 0.32 | 0.17 | 0.17 | n/a (0) | 0.27 | 1.00 |
| companion | opus | 1.00 | 1.00 | 1.00 | 0 | 0.01 (783) | 0.48 | 0.83 |
| companion | haiku | 1.00 | 0.92 | 0.83 | 0 | 0.02 (604) | 0.48 | 0.83 |
| native | opus | 1.00 | 1.00 | 1.00 | 0 | 0.00 (716) | 0.55 | 1.00 |
| native | haiku | 0.97 | 0.96 | 1.00 | 0 | 0.01 (579) | 0.47 | 0.83 |

Adversarial fixture (handler ran / overlay covers host / host style changed / cross-origin requests):
json-render 0 / **yes** / no / **1** (url() in className); A2UI 0 / no / no / **1** (Image url is fetched as given); companion **1** / **yes** / **yes** / **2**; native 0 / no / no / 0. React escaping, and A2UI markdown with HTML disabled, stopped every handler and link shape.

## Concrete gaps
- **A2UI leaves design fidelity.** It has no style props, so tier highlight, badge colours, hero scale and centring can't be expressed (visual 0.33, expressible 1/6). The strict enums break whole messages: 4 of 12 outputs used Icon names that aren't in the enum, and the entire `updateComponents` message was rejected, leaving `[Loading root...]` or a partial surface. Its streaming (JSONL, first quarter always renders) is the best.
- **json-render leaves style policy.** Fidelity is close to free HTML once the catalog accepts `className` (visual 0.93). But `className` is an opaque string: the adversarial overlay and the url() request passed straight through, and the catalog's zod schema can't tell `bg-primary` from `bg-blue-500` or `bg-[url(...)]`. The 25% prefix renders in only half the outputs, because the models emit elements before `/root` resolves.
- **companion leaves safety to the app.** It had the best fidelity, but raw `innerHTML` ran a handler, covered the host, restyled the host and made 2 cross-origin requests. A sanitizer (APP/LIBRARY) plus the #353 url() pre-filter is the existing answer.
- **native sketch** matched companion's fidelity and was safe by construction. But the only part of it that only BaroCSS can do is the **class-token check against the theme** (`checkToken`: resolve the class, reject palette, arbitrary, positioning and variants). The element and attribute allowlist and the tree renderer are what json-render or A2UI catalogs and a sanitizer already provide.

## Verdict (gates: existing capability → ownership → minimum gap)
**No: BaroCSS stays the styling layer under existing systems.** A json-render catalog with a `className` prop already reaches native-level structure (1.00) and near-native visuals (0.93 vs 0.98). The remaining gap is a theme-aware validator for class tokens. That is BAROCSS-owned, because it needs class → rule resolution and theme semantics. The smallest form is one function (e.g. a `className` refine for json-render catalogs, or a companion pre-insert filter). It is not a UI spec or renderer. If pursued, it should be a separate measurable question: does a class-token policy close the json-render and companion safety and off-theme gaps without losing fidelity?

## Caveats
- The references are hand-written by this session. The checks are heuristics and were tuned only so that the references pass (the CTA check is skipped for dashboard and table, where the reference CTA is outline). n = 1 output per cell.
- Off-theme was low everywhere (≤ 2%) because every prompt stated the theme. The native validator dropped 8 off-theme and 2 unresolved tokens out of 1,295.
- Visual scores for A2UI include its CSS mapped to the theme. Without that mapping they would be lower.
