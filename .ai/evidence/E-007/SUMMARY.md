# E-007 — natural generation on the real site (vite dev), G1–G3

Environment: E-006's, unchanged. `apps/barocss-site` runs unchanged (`baroStart({config:{preflight:true}})`) on `vite` dev at
127.0.0.1:5190, and Chromium's only network path is `env.mjs`'s proxy (app origin only). Actor: headless `claude -p`,
`claude-opus-4-8[1m]`, CLI 2.1.173, Playwright MCP 0.0.76 only, fresh context and empty cwd per run. The prompt is the
contract's text word for word, preceded by `Page URL: …` as in E-006 and followed by `Task: …`. See `runs/*.json` → `prompt`.

Rerun (repo root, after `pnpm install && pnpm build:library`; `PW_MCP_DIR` = dir with `node_modules/@playwright/mcp` 0.0.76):
- self-test (gating): `node .ai/evidence/E-007/selftest.mjs` → `selftest.json` (exit 0). Site styled; 13/13 gating
  classifications; 9 grader controls + extractor control pass.
- runs: `node .ai/evidence/E-007/run.mjs G1` (`G2`, `G3`) → `runs/<task>.json`
- post-hoc audit (written after the runs, grading unchanged): `node .ai/evidence/E-007/audit.mjs` → `audit.json`

Files: `classify.mjs` (TW/BC token classifier, first-try extractor), `grader.js` (DOM diff, required parts, E-005/E-006
write detector), `grade.mjs` (shared orchestration), `run.mjs`, `selftest.mjs`. All committed in f8f28d6, before any agent
run, and not changed afterwards.

## Runs

| Run | First-try tokens R / MISS | First-try PARITY-MISS | Detected | Final section R / MISS | Remaining MISS (unnamed) | Parts | Claim | Grader | Agree | Turns / cost |
|-----|------|------|------|------|------|------|------|------|------|------|
| G1 | 84 / 5 | `focus:ring-2` `focus:ring-offset-2` `ring-1` `-translate-x-1/2` `shadow` | `ring-1`: computed `boxShadow` on the Pro card (#7, #12) → removed (#13) | 83 / 4 | `-translate-x-1/2` (badge), `shadow` (badge, Pro CTA), `focus:ring-2`, `focus:ring-offset-2` | pass | done | FAIL | **no** | 20 / $0.65 |
| G2 | 63 / 1 | `focus:ring-2` | — | 63 / 1 | `focus:ring-2` (input, button) | pass | done | FAIL | **no** | 10 / $0.34 |
| G3 | 54 / 2 | `hover:-translate-y-0.5` `leading-relaxed` | — | 54 / 2 | `hover:-translate-y-0.5` (cards), `leading-relaxed` (quotes) | pass | done | FAIL | **no** | 10 / $0.44 |

R = RESOLVED. AGENT tokens in the final sections: 0 in every run. AGENT tokens on first try: 0 in every run when only
class contexts are counted (`audit.json` → `firstTryClassContexts`). The committed `first_try.counts.AGENT` (33 / 19 / 8) is
inflated by prose words; see the notes below.

No miss was introduced after the first try: every PARITY-MISS the agents wrote was already in their first DOM insert. Of 8
first-try misses, 1 was detected (G1 `ring-1`) and 7 remain in the final sections. No final claim names any of them.

Were the properties checked? The tool-call code was searched for each property:
- G1: the badge's `translate` was never read. The screenshot (#16) shows the section, but the agent did not remark on
  the badge. `boxShadow` was read only on the cards, not on the badge or CTA, so bare `shadow` went unchecked. No element
  was ever focused.
- G2: no `boxShadow` read, no focus.
- G3: `lineHeight` was never read, nothing was hovered, and only `gridTemplateColumns` and the avatar size and radius
  were checked.

The remaining misses split into two kinds:
- State-only, never exercised: `focus:*` and `hover:*`.
- Cosmetic, on properties never read: badge centring, small shadows, and line-height.

## Misses by family (effect confirmed in `audit.json`: no computed change on BaroCSS, a change on the Tailwind 4.1.13 page)

| Family | Tokens (runs) | BaroCSS rule → why it has no effect |
|--------|---------------|--------------------------------------|
| ring (box-shadow composition) | `ring-1` (G1), `focus:ring-2` (G1, G2), `focus:ring-offset-2` (G1); control `ring-2` | `box-shadow` uses `--baro-shadow`, `--baro-inset-shadow`, `--baro-inset-ring-shadow` without fallback, and they are undefined. `focus:ring-offset-2` has no rule at all |
| single-axis translate | `-translate-x-1/2` (G1), `hover:-translate-y-0.5` (G3) | `translate: <x> var(--baro-translate-y)`, and the other axis var is undefined |
| theme var name | `shadow` (G1), `leading-relaxed` (G3) | `var(--shadow-default)` and `var(--line-height-relaxed)` are undefined |
| preflight border-style (not a PARITY-MISS under the contract's BC definition) | `border`, `border-2`, `border-t` (all 3 runs) | the rule exists (`border-width: 1px`), but nothing sets `border-style: solid`. Computed style is `none` page-wide, including the site's own header `border-b` |

The preflight border-style gap is invisible to the contract's classifier, which classes these tokens RESOLVED because a
rule with declarations exists. The G1 agent found it anyway: it read computed `borderTopStyle` (#9), noticed the navbar is
affected too, and added `border-solid` to its cards, though not to its outline CTAs. The G2 and G3 sections keep invisible
`border`/`border-t` borders, and their claims do not mention them.

## Notes (not pursued)
- Extractor: the committed "class string" rule treated the whole HTML template literal as a class string, because once
  quote-bearing tokens were dropped most of the remaining tokens were utilities. That swept prose words into first-try
  AGENT counts. RESOLVED/PARITY-MISS first-try counts are identical under a class-context-only count (`audit.json`).
- Grader reasons "baseline style attribute changed" (G1–G3) and "style attribute on new element" (G2) are artefacts.
  Playwright's screenshot sets `style=""` on `<input>` elements (`audit.json` → `emptyStyle`), and no run has a
  style/CSS write in its tool-call code (`grader.writes: []`). Every run also fails on remaining PARITY-MISS tokens, so
  no pass/fail changes.
- G1 removed a working `md:scale-[1.03]`: it read `transform` (none), while BaroCSS and Tailwind v4 set `scale`.
- G1 `namedInFinalText: true` for `shadow` is a substring match on `shadow-xl`/`shadow-sm`. The bare token is not named.
- G3's first attempt crashed with an unhandled `ECONNRESET` in the runner before the actor produced output (empty raw
  dir). It was an environment failure, retried once unchanged.
- Refused requests were Chromium's own Google background traffic only. There were no retries for agent reasons.
- G2 and G3 noticed that similar sections already existed further down the page, and left them untouched.
