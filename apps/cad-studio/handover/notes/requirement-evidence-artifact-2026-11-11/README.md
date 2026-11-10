---
work_id: D591
artifact_type: current-requirement-evidence
status: verified
last_updated: 2026-11-11
---

# D591 — Read requirement evidence for a saved revision

P0, automation, rows 04, 12 and 16. FULL qualification of an additive action in the existing MCP `requirements` group. This delivers the first structured report in [#2279](https://github.com/barocss/barocss/issues/2279).

The action reuses `requirementResults` and `freshnessOf`. It returns a UTF-8 `requirement-evidence.json` artifact with byte count and SHA-256. The JSON preserves the authored requirement and source separately from each result and its freshness. A tool-like string in an authored source retains its original bytes through MCP. A confirmed or quote-verified statement can fail its check. An assumed value can pass its check.

The base and an exact top-level occurrence ID are the supported scopes. Occurrence checks use definition coordinates and the occurrence's material overrides. Reports distinguish occurrence ID, authored definition revision and root evidence revision. The latter includes all root authored fields except proposal and design history logs. It protects live direct sources and shop rows that the standard `documentRevision` does not cover. The report also provides that standard revision for correlation. Send the previous evidence `revision` as `expectedRevision` to require a matching snapshot. A current pass requires a matching revision, an ok result, a pass verdict and current freshness.

| Group | Result | Evidence |
| --- | --- | --- |
| E01 Scope and identity | PASS | One base and two same-definition occurrences are distinguished. The occurrences use different material inputs, result IDs and measured masses. |
| E02 Source and status | PASS | Authored source and basis round-trip in the digest file. Failure, pass, unsupported and failed evaluation retain separate states. Malformed requirements and ambiguous IDs refuse. |
| E03 Staleness and isolation | PASS | A wording-only edit and a live direct curve change both invalidate an old pin. In actual MCP an open 10 mm proposal leaves the accepted 11 mm report byte-identical. Stale calls return no artifact. |
| E04 Studio consumer | PASS | Actual desktop Studio shows the 11 mm failure, applies a direct edit to 10 mm, saves to browser project storage and reopens the exact saved bytes. Fresh MCP refuses the old evidence pin and returns the same requirement at 10 mm with a passing verdict. An independent box oracle checks volumes of 2200 and 2000 mm³ and centroid coordinates to 1e−8. |
| E05 Contract | PASS | The action retains the v2 tool group and existing result envelope. Its public schema, focused checks, source audits, six targeted mutations and actual MCP are verified. |

Two independent source reviews identified revision gaps, coercion of missing intersection volume to zero and reuse of a cached print check after a failed probe. The report guard refuses a failed auxiliary evaluation or an intersection body with unavailable volume. A report uses its own body-array key so a later call cannot reuse a poisoned print report. Existing checks and approval behavior remain separate from this export.

- **PASS** — Actual desktop Studio, actual local MCP, independent arithmetic, focused checks, six mutations, types, lint, build and docs examples.
- **FAIL** — The first tool-list check exceeded the existing 25,000-character cap and the first schema test used a document without requirements. The corrected list is 24,980 characters and the corrected fixture passes. The aggregate docs gate retains the refusal table and public inventory differences recorded in D590.
- **NOT_RUN** — Persistent defect closure, approval-linked history, nested occurrence selection, broad checker coverage, paid live runs, mobile, whole-kernel and broad browser suites.

The local MCP session reads its document at startup. The desktop check used a fresh session on the Studio-saved bytes. This milestone exports current evidence and retains the first failed report as an external artifact. The issue remains open.

[Commands and evidence custody](qualification.json).
