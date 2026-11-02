---
work_id: D452
artifact_type: ordinary-boolean-workflows
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap autonomously, one bounded category at a time"
last_updated: 2026-11-03
---

# C2-4 ordinary Subtract and Intersect

Two existing Boolean workflows pass all eight declared links each. A third, create-only Subtract control confirms reversed operand order. This decision adds no product code, Boolean admission, Keep control or geometric tolerance. Baseline is `8369dd600066c918917d91081af3901ed18f6a76`. Numeric receipts, commands and exclusions are in [qualification.json](qualification.json).

## Inputs and fixed physical expectations

The authored input reuses D447's exact A plate prefix and appends an ordinary tagged B rectangle/extrusion. This is an input recipe, not a new UI construction claim. A occupies [-20,-20,0] to [60,20,10], volume 32000. B initially occupies [40,-10,0] to [80,10,10]. Editing original B Extrude Corner X from 40 to 36 shifts B to [36,-10,0] to [76,10,10]; Width stays 40.

| Result | Original B / edited B volume | Original / edited centroid |
| --- | --- | --- |
| A minus B | 28000 / 27200 | [110/7,0,5] / [256/17,0,5] |
| A intersect B | 4000 / 4800 | [50,0,5] / [48,0,5] |
| B minus A, create only | 4000 | [70,0,5] |

Independent Python closed forms verify native polygon corners, oriented support planes, bounds and centroid. Every result is one strict valid closed solid with genus zero. The Subtract polygon has eight concave boundary vertices; Intersect and reverse Subtract are boxes. Targets stay at 1e-9 relative volume and 1e-9 mm absolute centroid, bounds, support and corners. Maximum executed relative volume error is 6.822e-16; centroid error is 4.974e-14 mm; native bounds/support/normal errors are zero. Display meshes only map actual output IDs to visible body keys and rows.

## Real Studio behavior

Each main branch uses public Open and real body-row picks. Selecting only A and invoking the command shows the existing unavailable-command toast and retains the exact seed and history. The palette entry remains selectable; no disabled Apply HUD is claimed. A then Shift+B determines operand order. Both live operands are consumed into n4/b4, while their original definitions and history remain. Model Subtract uses parent n1/tool n3; Intersect uses left n1/right n3. No public Keep control exists.

Each workflow creates the result, edits original B Corner X 40 to 36, performs exact Undo/Redo, and applies original B Extrude Distance 0. The native nonzero-height guard refuses that edit; document, history and accepted native result remain exact. Each branch then performs its own project Save, Close, same-context page reload, Open and Corner X 36 to 40 re-edit. The result and Boolean references return to the original created document. Reverse Subtract uses real B then Shift+A picks and confirms parent n3/tool n1 and the separate expected box. Its edit/persistence links were not run.

## Retained first failure and verification

Run01 qualifies the complete Subtract workflow and the first six Intersect links. It then FAILS because the external test helper blindly toggles an already open Versions panel, closing it before Save. Geometry and product behavior did not fail. The failed receipt is retained unchanged. Driver02 opens the panel only when needed. Run02 repeats only the required Intersect antecedents, completes its remaining persistence links and runs the reverse control. It does not repeat the passing Subtract workflow.

PASS: five native plus five independent preflight checks, the current native empty-algebra test (1/1), two Studio workflows (8/8 each), and reverse creation. Run01/02 retain 23/14 screenshots, 16/11 native reads and 12/8 independent physical reads. Root viewed eight images. Frozen/current source capsules match at 1192/1193 paths. Both owned project namespaces were removed; contexts, browser and server closed; owned wrapper PIDs are absent and gate leases released. Both runs have zero downloads and zero page/console errors.

FAIL: the original run01 harness panel failure remains explicit. NOT_RUN: new build/types/lint and full kernel, because no product or repository test source changed; retained D449/D450 checks and D433 full-kernel authority apply. Native empty-algebra coverage does not qualify an actual empty-result UI workflow. General curved Booleans, every operand order/profile and reverse edit/persistence remain unqualified.

Routine driver work used GPT-6.1 Sol Medium. Native and independent geometry review used GPT-6.1 Sol High. Root owned the gate, Studio execution, source freeze, cleanup and visible review. Core CAD readiness remains NOT_MEASURED; legacy 43% stays frozen. Issues #535 and #534 remain open because their broader acceptance criteria are not met. Existing HOLDs and download/release gates remain unchanged.
