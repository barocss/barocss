# BaroCSS CAD documentation

The documentation site for the CAD stack: the studio, the AI agent, `@barocss/cad`, `@barocss/cad-model` and
`@barocss/gpu`. VitePress; `pnpm --filter @barocss/library-docs dev` to work on it, `build` and `check:docs` to check it.

Rewritten from scratch on 2026-10-23 (owner: "전부다 지우고 문서사이트를 다시 시작해도 좋아"); the earlier site, its
example builders and evidence are in git history before that commit.

- **Structure:** `docs/.vitepress/sidebar.mjs` is the one list of pages, each with the lane that writes it.
- **Status:** a page still being written carries a "Being written" box; `check:docs` reports how many are left.
- **Rule:** every statement is checked against the code as it is; code samples are taken from tests that run.
