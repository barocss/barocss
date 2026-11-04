---
work_id: D520
artifact_type: roadmap-replan
status: done-documentation-only
last_updated: 2026-11-04
---

# D520 — Replan CAD around product safety and finite acceptance

The owner asked to rebuild the complete roadmap after the D519 package and Studio audit. This is a documentation-only change, not implementation of its findings. [Current roadmap](../../roadmap.md) is the sole current status index; detail lives in eight linked track pages. All34 row IDs, old decisions, first failures, issue gates and bounded proofs are preserved.

## Decision and scope

Replace the accumulated current/history ledger with a short current snapshot and this execution order: P0 document/result safety, P1 daily parts, P2 drawings/exchange, P3 static assemblies, P4 Studio/Viewer/GPU/SDK readiness, P5 advanced geometry/direct editing and P6 ecosystem/PDM. CAD React and Physics library retain independent tracks. A reproduced wrong-success/data-loss blocker may move before breadth; broad unsupported/HOLD scope does not silently become an implementation task.

P0 has12 named acceptance units derived from the audit. Their initial runtime reproduction is NOT_RUN, and this plan closes none. D521 / P0-R01 is next MAIN: reproduce delayed version completion across document/session changes. Do not assume every source suspicion is already a runtime failure. Version/merge ownership takes precedence because it can replace the owner's current document.

Keep existing C1–C8 IDs as historical aliases and34 rows as stable scope references. Do not renumber issues or claim those broad rows are equal units of work. Freeze a concrete acceptance matrix for the selected category before reporting N/M. Whole CAD/core readiness remains NOT_MEASURED; global denominator is not yet frozen. Establishing that finite product baseline is part of the continuing acceptance work, not fabricated completion at this checkpoint.

The owner authorized the replan, not held work: UI redesign, nonzero-cone expansion, fitter/thicken/widening, Studio Physics/Motion, manufacturing/equipment, schema5/migration, WebGPU CI and release retain gates. Downloads/paid live runs require prior permission each time; mobile tests remain excluded. No new dependency or root configuration is changed.

## Reference-informed product target

During this replan the owner added CADCraft, SolidCraft and CadXStudio as references. [Primary-source review](../../roadmap-tracks/05-reference-review.md) separates ArtCraft CADCraft from the unrelated getcadcraft/PartCraft suite, supplier declarations from independent proof, and documented features from complete workflows. The CadXStudio site body was not readable; its company profile is the qualified first-party source. No competitor was installed or run and no files/binaries/models were downloaded.

[Baseline B01–B10](../../roadmap-tracks/04-product-baseline.md) makes the first mechanical-CAD target explicit, including ordinary enclosure/sheet geometry and the existing automation entry points. Ten named scopes are not a readiness score: required executable subcases and retained-evidence coverage remain NOT_ADJUDICATED. Define and adjudicate them before publishing scoped coverage; even10/10 would not mean full CAD or release. Reference feature counts, claimed manufacturing readiness, architecture and agent-hour percentages are not adopted.

## GitHub reconciliation added by the owner

Primary GitHub connector reads fetched192 open issues using REST pages100+92 and an empty end page. The CAD-title search returned85; recent creation search returned five issues #2282–#2286. Search-normalized state fields were null, so REST state=open is authoritative for this snapshot. Selected101 body payloads were fetched for85 CAD-title issues and16 related issues. All15 epic REQUIRED FEATURES sections yield129 unique registered IDs, now preserved in the [registry](../../roadmap-tracks/07-requirement-registry.md). These are inventory/disposition counts, not129 absent features or101 completed acceptance audits.

The [live intake](../../roadmap-tracks/06-github-issues.md) maps101 selected primary destinations, new proposals, retained proofs, other owners and gates. [Track08](../../roadmap-tracks/08-other-issue-routing.md) accounts for the remaining91 issues by metadata only, including27 shared provider candidates;06+08 therefore preserve routing for all192 open IDs without implying full-body or readiness adjudication. Seven selected comment threads yielded39 comments;13 selected comments were fully reviewed, including the latest four STEP comments. This is not an all-history/comment audit or issue-closure check. Snapshot time:2026-11-04 14:37:31UTC. No GitHub issue/comment/state/label write is performed. Old priority/READY prose in issues cannot override current owner direction.

## Alternatives and consequences

Retaining the615-line chronological index would preserve links but leave multiple obsolete next-item/latest-checkpoint statements in the current surface. Renumbering every scope row would break evidence and issue navigation. A current snapshot plus stable row map and detailed tracks preserves those links and exposes the next actionable acceptance. The tradeoff is maintaining several small pages; only the index owns current state, so detail pages must not grow duplicate status ledgers.

The unchanged previous index is archived as [roadmap-history-D418-D518.md](../../roadmap-history-D418-D518.md), SHA256 `d15ac8483f443e258f10b6f2cf1334d93cda5d5b86902c2a7e62e5bae1e33e08` (86781 bytes). The original handoff is archived beside its entry point as [history-through-D518.md](../claude-handoff-2026-11-02/history-through-D518.md), SHA256 `e51e2a81c6a2ce1093658297aa516a373ffc30a248fb98b9edac19485a62b533` (39391 bytes). Their historical next-item text is not current authority.

The new handoff points at current order rather than repeating every decision. D519 records the audit separately. The stale D433-latest statement is removed from current navigation; D482 is cited as a later historical full-kernel run, without claiming a current-head suite pass. Existing D501/D505 custody failures, PDF deferral and original Physics rank/adoption gaps remain linked through the archives and canonical notes.

## Verification

Documentation scope: index, linked track pages, handoff, decision navigation and two small decision records. Check local links in newly authored documents, all34 row mappings, P0-R01–R12 inventory, exact archive hashes and unchanged product source; run git diff --check. Review these documents independently using Sol Medium before checkpoint. Root owns serial adoption/commit. The detailed track drafting/review roles do not run product tests or write shared product files.

PASS: 12 authored Markdown files, 293 local links with zero missing paths, all34 scope rows,129 exact registered IDs,101 selected plus91 metadata-only issue destinations (all192 unique),13 selected comment links and both exact archives. Independent Sol Medium document review is APPROVED. Product source is unchanged. Commands and final outcomes are recorded in [qualification.json](qualification.json). Actual Studio, builds, runtime tests, numerical oracles, CI and issue closure are NOT_RUN for this docs-only milestone, as in D445's planning boundary. This is not a SMALL defect-fix closeout. The first product task still needs its selected tier and root's actual Studio flow. No new product acceptance, percentage, deployment, release or develop merge follows.

Publish this reviewed checkpoint by ordinary push to origin/local/cad-dev under easylogic <cyberuls@gmail.com>. Preserve unexpected WIP; use named add paths only. Do not use stash/amend/rebase/reset/force push. Subsequent implementation consumes this plan under existing operating rules.

## Reproducible documentation checks

Run from the assigned worktree with Node22.19.0 selected. These commands inspect documents only; they do not start Studio or a build.

```sh
git diff --check
python3 - <<'CHECK'
import hashlib, re, subprocess
from pathlib import Path
r = Path('apps/cad-studio/handover')
files = [r/'roadmap.md', r/'notes/claude-handoff-2026-11-02/README.md',
         *sorted(r.glob('roadmap-tracks/*.md')),
         r/'notes/cad-package-studio-audit-2026-11-04/README.md',
         r/'notes/cad-roadmap-replan-2026-11-04/README.md']
links = 0
for p in files:
    for target in re.findall(r'\]\(([^)]+)\)', p.read_text()):
        target = target.split('#', 1)[0]
        if not target or '://' in target: continue
        assert (p.parent/target).exists(), (p, target)
        links += 1
rows = re.findall(r'^\| \[(\d\d)\]\(roadmap-rows/\d\d.md\)', (r/'roadmap.md').read_text(), re.M)
assert rows == [f'{i:02}' for i in range(1, 35)]
ids = re.findall(r'^\| ([A-Z]+-\d+) \|', (r/'roadmap-tracks/07-requirement-registry.md').read_text(), re.M)
assert len(ids) == len(set(ids)) == 129
for path, digest in [('roadmap-history-D418-D518.md', 'd15ac8483f443e258f10b6f2cf1334d93cda5d5b86902c2a7e62e5bae1e33e08'),
                     ('notes/claude-handoff-2026-11-02/history-through-D518.md', 'e51e2a81c6a2ce1093658297aa516a373ffc30a248fb98b9edac19485a62b533')]:
    assert hashlib.sha256((r/path).read_bytes()).hexdigest() == digest
for path in subprocess.check_output(['git', 'diff', '--name-only', 'ccce78c671c8'], text=True).splitlines():
    assert path.startswith('apps/cad-studio/handover/'), path
print('PASS', len(files), 'authored Markdown files;', links, 'local links; 34 rows; 129 IDs; exact archives; documentation-only tracked delta')
CHECK
```

The final Git identity, normal push and remote SHA comparison are separate checkpoint operations. All product/runtime validation remains NOT_RUN for this planning milestone.

The first combined ad-hoc validator passed link/archive checks, then failed with IndexError because exec shared its p loop variable with the issue-file variable. No product ran. Isolating that unchanged snippet namespace and using the explicit issue path corrected the tool; the final full documentation reconciliation passes. Preserve this tool-only failure separately from product validation NOT_RUN.
