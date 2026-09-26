# #414 fresh-agent onboarding runs

## Method
- 3 tasks (CDN page, Vite + Tailwind companion, SSR with `@barocss/server`) x 2 runs each; run1 = sonnet, run2 = haiku.
- Fresh local subagents with no prior context. They could use only the public docs (barocss.com, the GitHub README, npm). Repo paths were off limits.
- The human approved npm installs in a scratch directory.
- Each run wrote `LOG.json` (steps, doc URLs, problems, minutes). Its small source files are copied here. node_modules, caches, dist, lockfiles and logs are excluded.

## Per-run results
| run | success | minutes (self-reported) | installed | problems |
|---|---|---|---|---|
| cdn-run1 | yes | 8 | browser@0.10.1 (jsdelivr, from Quick Start) | homepage has no CDN snippet; README uses unpkg @latest but Quick Start pins jsdelivr 0.10.1; npmjs 403 |
| cdn-run2 | yes | 0.04 (**implausible**: "2.4 s to working page" is a self-reported timing error) | browser@0.10.1 (jsdelivr) | none reported |
| vite-run1 | yes | 15 | browser@0.10.1 (exact pin), tailwindcss ^4 | **version mismatch**: the pin followed the docs (latest is 0.11.0) and the agent didn't notice. Also: `new BrowserRuntime()` vs `getRuntime()` with no guidance; companion page has no install line; no Vite steps; npmjs 403 |
| vite-run2 | yes | 5 | browser ^0.11.0, tailwindcss ^4 | site lacks detailed Vite + Tailwind steps (the agent used the README) |
| ssr-run1 | yes | 10 | server ^0.11.0 | API index isn't clearly an index (server details only on server-runtime); README lacks ssrStyleTag; Quick Start 0.10.1 pin; npmjs 403 |
| ssr-run2 | yes | 2 | server ^0.11.0 | none reported |

All 6 runs succeeded.

## Ranked doc-fix list
Ordered by how many runs each item blocked or slowed. "Still true" was checked against the develop sources (`apps/barocss-docs/docs`, `README.md`) on 2026-09-27.

| # | finding | runs | still true on develop? |
|---|---|---|---|
| 1 | Quick Start pins `@barocss/browser@0.10.1`, but latest is 0.11.0. This caused vite1's install of a stale version. | cdn1, ssr1, vite1 (3) | **Yes**: `guide/quick-start.md` lines 13/33/45/55 and `guide/jit-mode.md:167` pin 0.10.1; the package is 0.11.0 |
| 2 | There's no runnable Vite + Tailwind example, and the site has no detailed Vite steps | vite1, vite2 (2) | **Yes**: no guide/integration page mentions Vite |
| 3 | Quick Start uses `new BrowserRuntime()` while the companion guide uses `getRuntime()`, with no guidance on when to use each; the companion page has no npm install line | vite1 (1) | **Yes**: quick-start.md:21 vs tailwind-companion.md:18; the companion page has 0 npm/pnpm lines |
| 4 | README CDN snippet uses unpkg `@latest`; Quick Start uses a pinned jsdelivr URL | cdn1 (1) | **Yes**: README.md:45 |
| 5 | Homepage has no CDN snippet | cdn1 (1) | **Yes**: `index.md` has no script/CDN snippet |
| 6 | The API index page doesn't read as an index (it opens with a browser Quick Start); server details sit only on server-runtime | ssr1 (1) | **Yes**: `api/index.md` has 0 ssrStyleTag mentions; `api/server-runtime.md` has 7 |
| 7 | README doesn't mention `ssrStyleTag` | ssr1 (1) | **Yes**: 0 matches in README.md |

## Tooling (not a doc defect)
- npmjs.com package pages returned HTTP 403 to the agents' fetch tool in 3 runs (cdn1, vite1, ssr1). This is likely an agent-tool block rather than a docs problem. The agents fell back to the GitHub README.
