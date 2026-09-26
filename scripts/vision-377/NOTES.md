# #377 Vision re-map: the AI UI loop beyond styling, and ranked candidate outcomes

Desk research only (2026-09-26). No probes run and no model calls: **cost $0**. Inputs: `.ai/VISION.md`,
`.ai/STATE.yaml` (K3–K13, D1–D22), `docs/autonomy-v3.md`, `scripts/*/NOTES.md` (#346, #364, #374, #375),
closing comments of #192, #231, #264, #289, #319, #364, #375, plus the public sources cited inline.
Framing is coordinated with #376: that issue measures **whether json-render/A2UI leave a gap a BaroCSS-native spec would
fill**. This note doesn't measure formats. It only places #376 in the loop (stages 2–3) and ranks around its verdict.

## Where the evidence already stands (not re-derived)

- Modify and verify classes on a live page: needs no BaroCSS surface (O1 done; K3, K5, K7, K9: real agent, L3).
- Generation with free-form classes: silent parity misses (K10, L3) are fixed per family (K11/K12, L2). A per-class
  resolution report built only on `has()`/`getCss()` cut silent misses from 7/8 to 0 (K13, L3). This is BaroCSS-unique:
  computed style can't tell a broken rule from an inactive state.
- Delivery: code-gen tools (v0, Lovable, Bolt, shadcn) ship Tailwind through a real build, so the BaroCSS fit there is parity
  at most. Protocol runtimes (A2UI, AI SDK) keep class strings away from the model. MCP Apps `rawHtml` and json-render
  `className` are the runtime-class entry points (#192).
- O4 companion next to a Tailwind build: adoptable from the docs by strong models; weak models are unreliable (#289).
  Base-class conflicts resolve to "the model's intent wins", matching `cn()` (#231).
- O5 embedded widget: Shadow DOM plus strict CSP, parity 1.0, 0 host damage, adversarial classes style nothing (#364, $0.42).
  Holds in Firefox and WebKit too (#374). The fuzz harness is in place (#319), and url() is handled by CSP plus the pre-filter (#346/#353).
- O6 config inference from built CSS: partial. Theme and dark mode are inferred used-only; custom variants and functional
  `@utility` are not. Parity against the recipe is 256 inferred vs 281 (#375).
- Explaining why an element looks the way it does (O3): parked (candidate).

## The loop, end to end

| # | stage | owner today | pain evidence | BaroCSS-unique angle? |
|---|---|---|---|---|
| 1 | Intent (prompt, brief, reference image) | Agent / app (chat UIs, v0, Lovable) | Out of scope for styling. Design2Code-style benchmarks show intent-to-UI fidelity is still moderate ([Design2Code topic](https://www.emergentmind.com/topics/design2code-benchmark)) | None. Natural language stays outside BaroCSS (working assumption). |
| 2 | Generation (code, spec, or HTML+classes) | Model plus tool: code-gen via a build; spec via json-render/A2UI (#192) | Silent class misses (K10). Models don't apply org design systems unless given a component registry: registry-based context reached ~95% compliance, beating instruction and context strategies ([CHI'26 EA](https://doi.org/10.1145/3772363.3798616)) | Yes, narrowly: which classes resolve under *this* theme and config (K13). The registry finding points to components, not CSS, as the compliance lever. |
| 3 | Validation (schema, lint, safety) | json-render/A2UI schemas (structure); Lovable lints raw colours (#192); BaroCSS guards (#319, #346) | Nothing validates model-chosen **styling** against theme tokens in spec systems (#376's premise; A2UI ignores the agent's theme, #192). Off-theme values are unmeasured by us. | **Yes**: class → rule resolution plus theme semantics can decide "on-token / off-token / unresolved" per class. This is the strongest unexplored angle. |
| 4 | Rendering (DOM, components, iframe, native, email) | Browser, React, host renderers, MCP host iframe | Email and native: `scripts/email-probe` exists, but cross-surface was never ranked. Clients don't run a runtime, so it would be build-time. | Weak. Rendering belongs to BROWSER/APP. Email is only a BaroCSS angle if it inlines resolved CSS, where existing tools (juice, Tailwind + inliner) already compete. |
| 5 | Styling (class → CSS delivery) | Tailwind build (dominant); `@tailwindcss/browser`; BaroCSS runtime (O4/O5) | Parity gaps closing (K11/K12, drift check #365). O5 holds cross-engine (#374). | **Yes, core**: the proven territory (O4/O5). Remaining work is maintenance-shaped. |
| 6 | Interaction / state (events, data binding, state variants) | App / framework; A2UI/json-render data binding | State variants (`focus:`, `hover:`) are where agents miss silently (K10, K13 arm2). | Partial: the resolution report already covers state classes; behaviour and state logic are APP. |
| 7 | Iteration / editing (multi-turn changes) | Agent plus DOM/source (O1) | Multi-turn quality degrades as early flaws are inherited and amplified ([MT-Web2Code](https://arxiv.org/pdf/2608.03474)). Our O1 runs were single-turn with a fresh context. | Unknown. Possibly the drift of classes off-theme or unresolved over turns, which BaroCSS can detect (stage 3 reused). No evidence yet that it's styling-caused. |
| 8 | Persistence (saving generated UI: source, spec JSON, CMS blocks) | App / CMS / repo; build-time scanning | Runtime classes stored in a CMS miss the Tailwind scan (#253/#289 scenario), and O4 answers that. Themes live in built CSS; recovering them is partial (O6, #375). | Yes, narrowly: config inference (O6) and the companion (O4). Both are already measured. |

Summary: the stages where BaroCSS knowledge applies are 2, 3, 5 and 8. Stages 5 and 8 are measured (O4/O5/O6). Stage 2 is
measured for free-form classes (K13). **Stage 3, validating styling against the design system, is the one unmeasured
stage with a BaroCSS-unique angle.** Stages 1, 4 and 6 are owned elsewhere. Stage 7 is unexamined, and the styling cause there is unproven.

## Ranked candidate outcomes

Ranking criterion: the answer most changes what BaroCSS builds or stops building.

### 1. Design-system enforcement: can BaroCSS judge model styling against the theme? (stage 3, also serves 2 and 7)
- **Assumption:** models emitting classes (free HTML, or json-render `className`) choose off-theme values (arbitrary
  `bg-[#hex]`, `p-[13px]`, default palette colours when a brand theme exists) often enough to matter, and a BaroCSS-derived
  per-class verdict (on-token / off-token / unresolved) makes the agent fix them, like K13 did for unresolved classes.
- **Existing-capability test first:** Lovable-style lint rules, ESLint Tailwind plugins, the registry/component approach
  (the CHI'26 95% result), and Tailwind v4 `@theme` with `--color-*: initial` (which removes defaults so off-theme
  named classes don't exist) may already do it. Arbitrary values still pass all of those.
- **Cheapest experiment:** reuse #376's 6 requests and outputs (no new generation), plus a theme with brand tokens.
  Classify every class with a throwaway script over `getCss()` and the theme (which tokens a rule references). Measure the
  off-theme rate per model. Then run one K13-style arm (the verdict shown after generation) with 1 strong and 1 weak model, about $1.
- **Level:** L2 for the off-theme rate (script over committed outputs). L3 for "the verdict changes agent behaviour".
- **No-new-code alternative:** docs recipe: `@theme { --color-*: initial; … }` plus a lint rule banning arbitrary values,
  applied by the agent. If that recipe gets the off-theme rate to about 0, BaroCSS builds nothing here.

### 2. Productize the resolution report, or prove agents don't need it (stage 2, the K13 follow-up)
- **Assumption:** the K13 gain survives a weaker model, multi-insert or streaming generation, and delivery through json-render
  `className`, not only one strong actor with one insert (K13's caveats; U1).
- **Cheapest experiment:** rerun E-011 arms 0 and 1 with a weak model (haiku-class) and with incremental inserts, on the
  current release (parity gaps are now fixed, so the baseline may already be about 0). About $1.
- **Level:** L3 (real actor, frozen grader from E-007/E-011).
- **No-new-code alternative:** a 20-line documented snippet over `has()`/`getCss()` (the evidence script as-is). If the
  post-parity baseline has no misses, the report is unnecessary: stop.

### 3. Multi-turn editing drift (stage 7)
- **Assumption:** over 3–5 edit turns on generated UI, styling errors (unresolved or off-theme classes, conflicting
  utilities) accumulate, and styling is a meaningful share of the error snowballing seen in MT-Web2Code.
- **Cheapest experiment:** one generated section from #376 or E-007, 4 scripted edit turns by one model. After each turn,
  classify classes (resolution plus the candidate 1 classifier) and grade against the per-turn intent. About $0.5.
- **Level:** L2 for the drift counts. L3 only if it proceeds to an intervention.
- **No-new-code alternative:** O1 already shows single-turn modify+verify needs nothing. If drift is structural or
  semantic rather than styling, it belongs to AGENT, and BaroCSS stops here.

Not ranked: cross-surface (web → native/email). Ownership is APP/LIBRARY, clients run no runtime, and existing inliners
compete, so it fails the existing-capability test on paper. Revisit only if #376 finds a spec format worth rendering beyond the web.
A BaroCSS-native UI spec is left to #376's verdict. If #376 says "yes", candidate 1's classifier is its validation core, so
running 1 first is useful either way.
