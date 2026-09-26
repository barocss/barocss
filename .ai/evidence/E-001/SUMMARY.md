# E-001 per-task records

Actor: headless `claude -p` (model `claude-opus-4-8[1m]`, CLI 2.1.173), fresh context per task,
built-in tools disabled (`--tools ""`), only Playwright MCP 0.0.76 browser tools
(`--cdp-endpoint` to headless Chrome), cwd = empty temp dir, `--setting-sources ""`.
Server allowlist: `/` (page) and `/packages/barocss-browser/dist/cdn/*` only, so the grader and contract were unreachable.
Full records: `tasks/T*.json` (prompt, every tool call + input, final text, class diff, grader detail, baseline/current snapshots).

| Task | Classes the agent wrote | How it verified | Claim | Grader | Agree |
|------|-------------------------|-----------------|-------|--------|-------|
| T1 | `bg-blue-600` → `bg-red-600` (kept `text-white`) | `getComputedStyle` bg/color in the next tool call | done | PASS (bg `oklch(0.577 0.245 27.325)`, color white) | yes |
| T2 | `p-4` → `p-8`, `rounded-md` → `rounded-2xl` | screenshot only (visual) | done | PASS (padding 16→32, radius 6→16) | yes |
| T3 | `space-y-2` → `grid grid-cols-1 md:grid-cols-2 gap-2` | `browser_resize` 800 and 600, `gridTemplateColumns` + item rows | done | PASS (1024: 2 cols × 2; 375: 1 col) | yes |
| T4 | `text-3xl` → `text-[42px]` | `getComputedStyle.fontSize` after a 300 ms `setTimeout` | done | PASS (30px → 42px) | yes |

Failures: none, so no ownership is assigned.

Environment failure (not counted, retried once as the contract allows): T1 attempt 1 ran with zero tools, because
`claude -p` started turn 1 while the MCP server was still `pending`. Fixed in the runner with
`MCP_CONNECTION_NONBLOCKING=false`. Record: `env-failures/T1-attempt1-no-mcp-tools.json`.

Pre-run grader change (committed in 1b1c9c2, before any agent run): the T3 check originally required 2 distinct row tops.
An inline-CSS positive control showed `space-y-2` offsets the second item of each row, so rows are no longer judged; only columns (x positions) are.
