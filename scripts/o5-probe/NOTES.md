# #364 O5 end-to-end probe (published 0.10.0)

Host page with its own (hostile) CSS under strict CSP
(`default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'nonce-…'; img-src 'self'; …`) embeds a hand-written
chat widget: one shadow root per assistant message, 5 messages per model (product card, signup form, order table,
warning alert, pricing snippet), plus one message with 22 generic adversarial class shapes (url()-bearing arbitrary
values/properties/variables/image-set/content/mask/cursor pointed at a counting endpoint on a second origin and at a
same-origin `/count/*`; unbalanced brackets; brace/semicolon/comment breakout shapes; document-targeting arbitrary variants;
huge values). Blocks are real `claude -p` output (opus = strong, haiku = weak), frozen in `blocks/`.

Packages: `npm pack` of `@barocss/browser@0.10.0` (CDN UMD bundle, includes kit 0.10.0) and `@tailwindcss/browser@4.3.3`,
unpacked into `.pkgs/` (not committed). Reference = tailwindcss `compile()` of the block classes, `<link>`ed in each root.

Rerun: `bash scripts/o5-probe/generate.sh` (model, once) then
`PW_DIR=… CHROME=… node scripts/o5-probe/run.mjs` (Chromium 1223, ports 7164/7165). Model cost: $0.42 total
(first generation $0.26 discarded: haiku asked clarifying questions in 4/5 replies; prompt then added
"Invent plausible sample content; do not ask questions" and all 10 were regenerated for $0.16).

## Results (2026-09-26; opus/haiku; 133/65 block elements, 15 host elements)

| arm | parity | parity vs ref on hostile host | widget→host | adv drop | CSP viol (opus/haiku) | url() hits at endpoint (xo / same-origin) | ms |
|---|---|---|---|---|---|---|---|
| ref (`<link>` in root) | 1.000/1.000 | 1.000/1.000 | 0 | 0 | 3/0 | 0 / 0 | 3-9 |
| none | 0.000/0.000 | 0.000/0.000 | 0 | 0 | 3/0 | 0 / 0 | - |
| baro root | 1.000/1.000 | 1.000/1.000 | 0 | 0 | 8/5 | 0 / 1 | 30-48 |
| baro root + nonce | 1.000/1.000 | 1.000/1.000 | 0 | 0 | 8/5 | 0 / 1 | 30-42 |
| baro root + nonce + docs pre-filter | 1.000/1.000 | 1.000/1.000 | 0 | 0 | 6/0 | 0 / 0 | 39-41 |
| @tailwindcss/browser | 0.000/0.000 | 0.000/0.000 | 0 | 0 | 21/18 | 0 / 0 | - |

- Opus's product card has an external `<img>` (3 violations in every arm, not CSS). Baro's extra 5 violations = the 5
  cross-origin url() forms the runtime emitted (bg, arbitrary property, cursor, content, mask); CSP blocked all of them:
  0 requests reached the cross-origin counter. The same-origin `url(/count/same)` loaded once (allowed by `img-src 'self'`,
  as the security guide says). The docs' pre-filter removed every url() form: 0 violations, 0 hits.
- `var()` indirection and `image-set()` shapes emitted nothing loadable. All breakout/unbalanced/document-targeting shapes
  styled nothing (only `p-[99999px]` and `[:host_&]:outline-8`, both inside the widget). Adversarial classes disabled no
  other rule (adv drop 0) and changed no host element; no `<style>` went to `document.head` (2 shared adopted sheets).
- Bytes: ~32 KB CSS per root view (the 163 KB/158 KB in result.json count the 2 shared sheets once per root, 5 roots).
- twb cannot style a shadow root: it scans the document and injects an un-nonce'd `<style>` into `<head>` (blocked:
  `style-src-elem`), and would not cross the shadow boundary anyway.
- Host→widget: with the hostile host every arm, including ref, differs on ~all elements (host `letter-spacing` and
  other inherited properties, plus `div{padding}` on the widget host box) - platform inheritance, identical for baro and
  ref (parity vs ref on hostile host = 1.000). Tailwind preflight does not reset `letter-spacing`; a widget must set it.

Verdict: O5 holds in an embedded widget under strict CSP (yes), with two host-side caveats that are documented behaviour,
not runtime gaps: same-origin url() loads unless `img-src` is narrower or the pre-filter is used, and inherited host
properties reach the widget unless its wrapper resets them.
