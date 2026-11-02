---
work_id: D442
artifact_type: step-native-name-loss
status: bounded-qualified
owner_role: executor
last_updated: 2026-11-02
---

# Disclose native face and edge name character loss

D442 continues rows 13/12 at baseline `1913e332e36eb0a48659c6141e01e98787397355`. Overall progress remains about 43%. **PASS:** 15 focused Model tests, unchanged output bytes/source keys, final types, one actual Studio flow and separate raw-token review. **FAIL retained:** the baseline silently changed a native UTF-8 face name. **NOT_RUN:** full kernel, new physical qualification, general Unicode support and output reopen. Exact hashes, commands and limits are in [qualification.json](qualification.json).

## Reproduced loss and selected correction

Two local one-solid 30×12×6 inputs differ only in a face label. Both use implementation level `4;1` for raw UTF-8, following the public [Part21 N304 text](https://www.steptools.com/stds/step/IS_final_p21e3.html), clauses 5.2/6.4.3.1/8.2.2. Independent token/reference/reachable-shape checks pass. Both public Model native reads are strict-valid. `n0.Face-é` survives before export but the reachable prepared face is `n0.Face-_`, while the baseline loss list is empty. The ASCII control is exact. Offline Model calls are separate from actual Studio proof.

The small Model correction appends one existing-list disclosure when an export-selected native `face.name` or `edge.name` contains a character outside printable ASCII. It uses the existing selected `breps` array. It does not scan raw STEP text, unused IDs, surface/curve fields or saved user labels, or duplicate writer topology/conversion policy. Hidden occurrences remain excluded; base `look.hidden` remains an appearance setting. The message says names are not retained, without promising that preprocessing includes every shape or replaces every field in the same way.

The writer and importer are unchanged. The two fixed whole outputs remain 6,860/6,858 bytes with the same source keys. Existing warnings keep their relative order. Six new public-Model tests cover retained face/edge fields, printable literals, header-only controls, ignored tokens with insertion preconditions, selection filters and label-only exclusions. Existing profile/bbox tests contribute nine more passes. Source/test lint, driver syntax/lint and final Model `tsc` after the last test/driver edit pass. No B-rep core changed, so a full-kernel run was not required.

## Actual Studio and separate file read

One actual public Open → Fit → STEP Preview → Cancel passes. The native face is `n0.Face-é`; the 6,890-byte actual prepared file contains the reachable `n0.Face-_` token, with one matching worker/UI loss item. Actual source `17ef25f79a73505e` differs from offline because the public filename/document differs. Cancel retains the authored document, adopted/native data, seven quantity fields, source and camera bytes exactly. Root reviewed all three PNGs and saw the model, the loss item and the retained model.

All 778 fixed inputs and 1,049 frozen paths match before, after and through cleanup/current verification; all 70 passive runtime bodies were rehashed. Missing direct responses for Camera.ts/flow-helper are recorded honestly; fixed source pins cover them. Errors, console errors, source changes and downloads are zero. Owned resources closed, PID 12377 is absent and the lease was released. The entire worktree remained frozen through cleanup.

A separate retained stdlib Part21 reader checks actual raw strings, references and reachability without kernel imports or SUT calls. Input/output both have one solid, six faces, twelve edges and eight vertices; the exact selected raw tokens and actual UI/Cancel records agree. These are bounded graph/name checks, not new physical or general format qualification.

## Follow-ups

[#2263](https://github.com/barocss/barocss/issues/2263) remains open: shared assemblies, AP242 presentation, sheets, PMI and remaining offset/topology acceptance are incomplete. Body IDs and tess-specific metadata remain outside this correction. The ASCII writer, Unicode/directive interpretation and general interchange acceptance are not expanded. No download, OCP use, paid call, release or develop integration occurred.
