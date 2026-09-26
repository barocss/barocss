# #290 streamed SSR and SSG probe (2026-09-26)

Next.js 16.3.6 App Router, React 19.2.8, Tailwind 4 (create-next-app --tailwind), `next build && next start`,
Chromium (Playwright) CPU 4x, viewport 1280, 3 runs, median. Setup and rerun: headers of `run-stream.mjs`,
`run-ssg.mjs`; `make-next.mjs` writes the pages into the app. Local builds of @barocss/kit/server/browser (pnpm pack).

## Existing hooks
- `useServerInsertedHTML` (client component, prop = sheet computed in the server component): works per chunk. Next
  writes the `<style>` into the body stream right before that boundary's hidden `<div id="S:n">`, never into `<head>`.
- React 19 `<style href precedence>` in a server component: works per chunk. React streams it with `media="not all"`,
  moves it into `<head>` and enables it before revealing the boundary. React drops other attributes
  (`data-barocss-ssr` is lost).
- Per-request tracking of sent sheets: React `cache()` (request-scoped). skip = build CSS text + earlier chunk sheets.

## Streaming
| arm | per-chunk unstyled ms (max) | dups | order ok | final |
|---|---|---|---|---|
| client (runtime observing body) | 0 | 0 | yes | 1 |
| shell sheet + client | 0 | 0 | yes | 1 |
| per-chunk sih / prec, skip = sent | 0 (chunk 2 never matches) | 0 | no | .993 |
| per-chunk + client runtime | 0 (chunk 2 never) | 0 | no | .993 |
| per-chunk, skip = build only | 0 | 33 | no (breaks earlier chunks) | .985 |
| per-chunk + runtime + app shim adopting late sheets | 0 | 0 | yes | 1 |

Client runtime alone shows no unstyled frame: React reveals a boundary from a script and the MutationObserver
callback styles it before the next paint. Per-chunk sheets get no-JS / pre-runtime paint right but break sm/lg
order: a later sheet's `sm:px-7` lands after an earlier sheet's `lg:px-8`. Full per-chunk sheets (no sent skip) instead
re-emit earlier `sm:` rules after earlier `lg:` ones. #268 adoption (head + startup only) never sees late sheets
(sih: body; prec: head but after startup, attribute stripped), so the runtime cannot re-sort them. A 5-line app shim
(mark + move to head + call the private `adoptSsrSheets()`) fixes order, 0 dups, final 1.

## SSG (next build, 2 prerendered pages, all 6 blocks)
| arm | match@first paint | final | FCP ms | inline CSS B/page | build time added |
|---|---|---|---|---|---|
| client runtime | .169 | 1 | 116 | 0 | 0 |
| build-time generateCssForHtml inline | 1 | 1 | 120 | 15970 | ~36 ms/page (cold runtime) |

Astro server islands: skipped (time). Not measured.
