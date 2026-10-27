# Docs lane brief (2026-10-23)

## Why this lane exists

On 2026-10-23 the owner asked for the documentation site to be rebuilt. Their words:

- "이제 그 문서 사이트 내용을 전부다 다 교체해야할 것 같아. 그 동안 구현한 것들이 완전히 달라졌어"
- "전부다 지우고 문서사이트를 다시 시작해도 좋아"
- "문서 사이트는 새로운 세션에서 진행 해줘"

## Role

You own `apps/library-docs/**` and nothing else. Work on the branch `claude/docs-lane-2026-10-23`, which starts from integration.

Another lane's file needs a change? Name the file and the change to the coordinator. Don't make the change yourself.

## State at W0

The coordinator removed the old site in the W0 commit: 91 pages, its example builders, evidence, profiles and samples. All of it stays in git history before that commit.

What W0 left in place:

- **The skeleton.**
  - VitePress, with the same package name, path and `build` script, so CI and `deploy-docs.yml` keep working.
  - `docs/.vitepress/sidebar.mjs` is the one list of pages. Each page has a `lane` field naming the lane whose code it describes; check facts with that lane.
  - Each page so far is an outline: a "Being written" box and its sections.
- **The check.** `pnpm --filter @barocss/library-docs check:docs` confirms:
  - every sidebar page exists;
  - every page is in the sidebar;
  - every internal link resolves.

  It also prints how many pages are still being written. `build` must pass too.
- **Removed scripts.** `check:api` and the old example builders are gone. The CI list (`docsValidationScripts`) is now `build` and `check:docs`.

## Scope

The CAD stack as it is now:

- the studio (`apps/cad-studio`);
- the AI agent: chat, v2 tools, cad-mcp, cad-cli;
- `@barocss/cad`, the kernel;
- `@barocss/cad-model`;
- `@barocss/gpu`.

The other packages are out of scope until the owner asks: physics, render, ui-*, server, browser, kit and cad-interop.

## Rules

- **Write in English.** The owner reads the coordinator's reports in Korean.
- **Write from the code as it is now.** Every statement must be checkable against today's source, tests or the handover records.
  - When unsure, read the code.
  - Read the lane decision logs: `apps/cad-studio/handover/decisions*.md` and `roadmap.md`.
  - If a question remains, ask the coordinator.
  - Never document something from memory or from the old site.
- **Take code samples from tests that run**, or add a doc test that runs them, so the docs can't drift. Don't paste untested code.
- **State limits plainly.** For example: WebGPU-only analysis maps, typed refusals, and that nothing is built in for standards (rows rule).
- **Screenshots:**
  - capture them from the studio with a flow-like script, run through the gate;
  - store them under `docs/public/`, at a size budget you set and record;
  - they're documentation assets, not evidence;
  - never commit logs, receipts or test output.
- **Standing rules from the common brief:**
  - no push or PR;
  - integration is never amended;
  - git identity `easylogic <cyberuls@gmail.com>`, and commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - heavy runs go through barocss-lanes-guard's gate (run them in the background);
  - kill only your own PIDs;
  - Node 22.
- **Work checkpoint by checkpoint.**
  - A checkpoint is a page group, or a few pages.
  - Each one ends with `check:docs` and `build` passing.
  - Then send the coordinator the SHA and the pages done. The coordinator merges.

## Order (W1)

1. Introduction and concepts: what it is, getting started, concepts.
2. Studio guide: tour, sketches, features, assemblies, drawings, BOM, manufacturing, frames, robots, display, rows, files.
3. AI agent: designing with the agent, tools, cad-mcp and cad-cli, proposals.
4. Packages: cad (index, modeling, robustness, formats), cad-model, gpu.
5. Reference: refusal codes (generated from the code if practical), the .bcad document, rows formats, limits, verification.
6. Screenshots and a final pass. Then the "Being written" count must be 0.

Before writing anything, send the coordinator your plan for (1) and for the screenshot approach.
