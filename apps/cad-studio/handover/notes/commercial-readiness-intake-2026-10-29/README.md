# Commercial-readiness intake — 2026-10-29

This is documentation intake from a user-authorized audit. It does not dispatch product code, change
the active A05/A06 order or qualify the GPU engine for commercial release. Keep package ownership and
Rendering HOLD boundaries. Check current source and retained receipts before selecting a fix.

## Existing open issues to connect

### GPU initialization rejection: #2107

[Issue #2107](https://github.com/barocss/barocss/issues/2107) was OPEN when read. Connect it to existing
Studio05 SDK/06 GPU/G15-accept and Viewer app ROADMAP4.3. The existing initialization-cleanup requirement
does not have an exact #2107 reference in the central Studio roadmap. Current repair/reproduction is
NOT_VERIFIED by this audit; the issue reports an older pinned failure.

Minimum scope: compare the current createViewer construction path and failure receipts, then account
for candidate device/context/buffer/listener ownership when no context or later setup rejects. Keep an
existing accepted Viewer usable. Preserve the original error/cause and failure phase. Completion needs
an exact-source consumer receipt proving candidate cleanup; a harness destroying an orphan does not
prove product cleanup. No new cross-owner assignment follows.

### GPU disposed image/source retention: #2144

[Issue #2144](https://github.com/barocss/barocss/issues/2144) was OPEN, explicitly BACKLOG/not dispatched,
when read. Connect it to existing06/GMAT-5/G15-accept resource lifetime and05 SDK; keep Rendering #2135
as a dependent consumer boundary. Suggested P1 does not override the current owner queue or HOLD.

Minimum scope: establish a finite disposed ImageTexture/CPU-source retention or supported caller-owned
release/reuse contract. Completion follows the original issue's at-least100 replacement plateau, with
shared accepted/candidate controls and before-upload/failure/queued-frame/recovery/dispose ownership.
Include a qualified actual replace/remove consumer flow when selected. Do not close caller-owned image
sources without its contract or infer GC/VRAM from public allocation counters. Presenter Geometry #2238
and one packed-map recovery profile do not prove this repeated-retention contract. Current fix is
NOT_VERIFIED by this audit.

## Actual Studio-owned Core evidence: explicit frame only

At exact a7264f0e59c25580b185b814a5e4b6b3a946f2a3, one normal Vite DEV profile/attempt/32 assertion
evaluations passed. A normal UI Box12×13×14 and canvas face selection survived one owned logical-device
loss, old lost and a distinct replacement. After explicit Core.frame/capture, document/selection/name/
History widget/dirty/local recovery/camera/body and the original Core/Mesh/Geometry remained. Three
4,104,000-byte native RGBA captures matched; point continuity delta was zero. This is not absolute
geometry accuracy, Undo/Redo stack proof, natural GPU failure, OOM/VRAM/performance or a release gate.

Automatic host presentation is NOT_QUALIFIED: each sample called Core.frame/capture explicitly. The
Vite load/resolve tracker observed1073 product modules/475 workspace resolutions/two direct third-party
loads, but allowed optimizer cache paths. Complete served/optimized/virtual/worker/static-asset response
provenance is NOT_QUALIFIED. Preserve the raw32PASS receipt; narrow the accepted claim, not its history.

The parent checked1211 snapshot files/Git blobs,90 artifacts, observed product bindings, actual typed
state fields, six DOM/element PNGs and native raw bytes. Canvas-named PNGs include DOM overlays and are
not pure framebuffer exports. Guard/syntax/probe/release were zero and owned cleanup completed.

Next independent gate: prepare passive actual-response provenance and observe public stats.frames plus
canvas presentation after replacement before any Core.frame/capture/render or user action. Separate a
spontaneous first frame from a later normal orbit/fit-triggered host frame. Do not repeat the explicit-
frame32 or earlier Core003–006 successes to claim this missing gate.

## Audit scope and retained evidence

The focused GitHub batch retained26 detail responses (18OPEN/8CLOSED), targeted13 comments from three
collections and77 unique search discoveries.59 search-only items lack direct detail review. This is
not all issue discussions or a whole-repository audit. Closed2235–2242 transfers are separate from
subsequent bounded implementation receipts. Existing DA-DUP-1/#2243 remains in its current roadmap;
do not duplicate it. Legacy API reconciliation and the seven CAD research/index items remain separate.

Full local evidence remains in:
`/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/`

- `research/open-issues-roadmap-intake-20261029.md` SHA256
  `8dd1171398ee4d957978990699708be112e0528af50896ecf9130cff3a74ad4f`
- `verification/open-issues-roadmap-intake-20261029.json` SHA256
  `74c3a51688af193e3b7ef5d2115834be3158c417b8a88ad92b71e2155b092468`
- `research/studio-owned-recovery-110551.md` and
  `runs/studio-owned-recovery-20261029T110551/verification.json`
- Raw Studio receipt SHA256
  `1ca7383e29472ca8f93b17a7bf335119b14cb5380e40e9888848a8ab004ed20a`
- Parent reviews `verification/open-issues-roadmap-intake-parent-20261029.json` and
  `verification/studio-owned-recovery-parent-110551.json`.

No product code, remote issue state, priority, branch, server or other author's WIP was changed.
