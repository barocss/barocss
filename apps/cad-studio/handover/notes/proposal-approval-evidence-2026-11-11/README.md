---
work_id: D592
artifact_type: proposal-approval-evidence
status: verified
last_updated: 2026-11-11
---

# D592 — Link Studio approval to requirement evidence

P0 automation, rows 04, 12 and 16. FULL qualification for one user-approved edit to a named assembly occurrence. The work reuses the Studio proposal controls, design history and the D591 MCP artifact. [Issue #2279](https://github.com/barocss/barocss/issues/2279).

A requirement edit preserved the old model hash and allowed a proposal to apply with old check and risk information. A concurrent chat merge also applied an approval over a newer user decision. The regression cases reproduce both failures.

Open proposals now pin the same authored inputs as the D591 requirement report. A stale or unpinned proposal needs review after rebase. A legacy numeric-index edit or unworked merge proposal without saved feature order cannot rebase after a root model hash change. Existing conformance coverage retains a legacy proposal with a named face and a newly created feature. The root assembly proposal still requires the user. The placed-part MCP route enforces the same requirement. A concurrent merge preserves the current decision and gives the user the reason when it declines to replay an approval.

Studio writes the exact before and after evidence revisions to the accepted proposal and design history. Partial approval uses the result after excluded features are removed. Both records share the decision time. The pair identifies the report inputs. The verdict still comes from the report for the named occurrence and requirement. In-place approval uses the edited definition's scope. Agent decisions retain the existing model hash and author without adding a user approval pair.

| Group | Result | Evidence |
| --- | --- | --- |
| A01 Revision boundary | PASS | Changed requirements and moved occurrences make proposals stale. Root proposal and history entries preserve the report revision. Studio requires rebase and keeps the proposal open after review. |
| A02 Approval authority | PASS | Actual local MCP refuses both root assembly and direct placed-part acceptance at autonomy 4. Controlled concurrent merge preserves the user's rejection and changed requirement. |
| A03 Studio persistence | PASS | Studio opens, previews and explicitly accepts P1. Project Save and fresh Open retain the exact bytes and user design history. Fresh MCP matches the stored revision pair. |
| A04 Same occurrence | PASS | Both 20 × 10 × 11 mm plates fail the height and volume limits. After approval only p1 becomes 10 mm and 2,000 mm³. The p2 control remains 11 mm and 2,200 mm³. An independent rectangular-solid calculation agrees for all eight measurements to 1e−8. The first failed report remains byte-identical. Fresh MCP refuses the old pin. |
| A05 Focused contract | PASS | 74 focused checks, four detected mutations, two source audits, types, lint and production build. The partial approval stamps the actual result. |

- **PASS** — The five scoped groups above. The observed assembly summary now says “assembly change” in Studio.
- **FAIL** — The first desktop fixture treated the aggregate summary as an individual requirement. The first focused run caught one stale helper name, the initial order guard caught a supported legacy fixture, and the Studio catalog assertion lacked the D591 action. The final scoped checks pass. The assembly preview still reports +0 mm³ for the placed-part change because its display measures only the base. D593 takes that visible defect first.
- **NOT_RUN** — Durable defect closure, nested occurrence or face-reference evidence, placed-index rebase breadth, in-place approval persistence, broad browser/kernel suites, mobile, live provider runs, and release.

The qualification covers one explicit Studio approval and one persisted evidence chain. #2279 stays open. B09 v1 remains 9/9 and four of the ten initial product scenarios have accepted v1 evidence. Whole CAD readiness remains NOT_MEASURED.

[Commands and evidence custody](qualification.json).
