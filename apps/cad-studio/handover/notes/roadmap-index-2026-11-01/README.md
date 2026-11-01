# D418 — Separate current navigation from historical records

Documentation-only, small tier. Base `b920418ae`. Sol Medium implementation; root review. [Counts, hashes, commands and qualification](qualification.json) are the numeric record.

The owner identified oversized roadmap management. The current status table, stable row scope, decision navigation and historical wording now have separate homes:

- [Roadmap index](../../roadmap.md): one authoritative current status table and active lane/next boundary.
- [Row pages](../../roadmap-rows/13.md): scope, owners, dependencies, acceptance and canonical evidence links for each numbered row.
- [Decision index](../../decisions.md): recent decision IDs and links to their canonical notes.
- [Original roadmap](../../roadmap-history-through-D417.md) and [original decisions](../../decisions-history-through-D417.md): unchanged full-text archives, retained once in the same folder.

The original root filenames retain collapsed compatibility appendices. Every original heading remains in order and links directly to its archived section. This preserves heading-generation input instead of assuming GitHub and VitePress slug rules are identical. An observed renderer-specific fragment alias is retained explicitly. The small current front matter and the larger fixed compatibility appendix are measured separately; repository history is retained, not deleted.

Current status appears only in the roadmap index. Row pages do not repeat status tables or numeric test results. New item notes and qualifications own those results. Future updates add a bounded canonical record and update navigation; they must not append full historical execution text to the indexes or create another full archive.

The operating handoff remains byte-exact. Original IDs, scope, acceptance boundaries, owner HOLDs, Motion/Physics/CAE gates, local-only browser CI and schema3/4 authority are preserved. This documentation change authorizes no new product feature or issue closure.

Verification checks both new untracked files and tracked incoming references, exact archive hashes, all original heading identities and archived-section links, numbered row coverage and current-runtime hash equality. One old missing evidence path remains only in its immutable archive. Parsed-link totals include generated heading permalinks and are distinguished from authored references. Initial scratch-command and validator-scope failures remain in the qualification; no historical evidence claim was silently repaired or removed.

No product source changes. New Studio, suite/build/type/API checks are NOT_RUN; the exact unchanged D417 runtime evidence is reused. GitHub rendering was not executed; installed local VitePress parsing and original literal heading preservation are the recorded checks. Raw inventories and parser output remain under `/tmp`, not in git.

The staged whole-copy whitespace check reports three pre-existing blank lines with trailing spaces in the historical decision body. They are preserved to keep the archive byte-exact. The earlier unstaged check omitted untracked archives; the shell continued after the staged warning, so a follow-up record distinguishes this historical FAIL from the passing new-content whitespace check. No published commit is rewritten.
