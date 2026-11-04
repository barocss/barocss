---
work_id: D523
artifact_type: bounded-current-export-fix
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D523 — Refuse incomplete or stale assembly 3MF

Priority P0-R03, rows10/13. Parent `524cddfd7c30d939fc0c1735dfa0f6f7c5248eb5`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Reproduced failure

The corrected original controlled baseline has2 PASS and9 FAIL across11 cases. Root then reproduces the actual native Worker boundary in desktop Studio. Public Open loads the existing base plate plus Cube fixture. Public controls assign Aluminium6061 and colour#D9534F. A genuine current export passes an independent Python ZIP/XML read. Public Instance X changes0 to200; the test-only scheduler holds the original placed Worker response before the real EngineClient callback, keeping all later responses FIFO.

While the current Doc says X200, public Export3MF downloads Cube coordinates X0..10. The independent reader checks each object, so the plate cannot mask stale Cube bounds. Root views the original stale-export PNG. After forwarding the same original MessageEvents to the actual callback, the export correctly contains X200..210. The baseline runner PASS means the pending-export product currentness contract is FAIL. The evaluator's placement works after delivery; no new kernel defect is inferred.

## Bounded correction

Only the private Studio useModelExports producer changes. The action uses existing root/placed freshness and synchronous accepted Doc/shown/evaluated/name refs. Every visible shown instance must have an entry; none is silently filtered out. Hidden instances remain excluded. Root decoration/assembly comes from the shown Doc with evaluated nodes/outputs, matching the existing STEP ownership pattern. After ZIP awaits, freshness, completeness and the same owner must still hold before download or feedback. Current ZIP errors use the existing export notice; stale success/error stays silent.

App, Model writer/public API, format/schema, geometry and tolerances are unchanged. A shown-versus-master controlled case guards visible-instance selection and appearance. This is current output ownership, not new format or variant capability.

## Verification and limits

Tier SMALL; implementation/test authoring GPT-6.1 Sol Medium. Root runs all heavy checks and actual Studio. Optional independent focused Sol Medium source review is APPROVED with no blocking findings.

PASS:16 new tests plus13 related STEP preparation tests,29 total/0 FAIL/0 cancelled/0 skipped; Studio types; final Model types after the last test edit; browser/scheduler syntax and diff. Controlled cases cover the existing instancesFresh=false guard, missing entries even with an inconsistent true caller flag, hidden exclusion, settled three-object coordinates/materials/units, shown visibility/decoration, delayed ZIP Doc/shown/evaluated/name changes, later loss of freshness/completeness, and current/stale compression rejection. The pending/stale/failed labels share one false-freshness input; they are not three independently run evaluator failures.

Root actual fixed Studio passes11 snapshots and4 independent file reads. Pending export produces no download. After original response delivery, Cube X200..210 is exported. Public Edit part changes extrude Distance10 to15 and Finish preserves placement and occurrence appearance; the resulting Cube bounds are [200,0,0]..[210,10,15]. Public Save stores the exact accepted Doc, a new browser context Opens that own file, and another export preserves the same bounds/material/colour. Every read checks ZIP CRC, two objects/two build items, eight vertices/twelve triangles per box, millimetres, identity item transforms, object/material references and literal bounds within1e-6. Root views baseline03/05 and fixed03/07/10 PNGs. This reads emitted mesh coordinates; it is no general B-rep/native mass certificate.

Each qualified run retains293 source/helper paths through cleanup. No page/console errors or worktree changes occur. The only runtime producer delta is useModelExports.ts; the fixed driver adds an explicitly fixed-only source-edit/Save/Open tail to the original public prefix. Five fixed local artifact downloads are expected (four3MF plus onebcad), with no dependency/network download. Both contexts, Chrome and Vite close.

FAIL retained: the first controlled harness configured map/shown inputs after hook render, then moved them before render; only the corrected original run qualifies that input boundary. First actual attempt used a word-boundary regex against concatenated Bodies1Volume text. Second already proves stale output but its release tail fails: native event redispatch does not reach the client in that harness. Traced direct FIFO forwarding of original events repairs the tool, and the final original-product run passes. No failed receipt is discarded or called a geometry regression.

NOT_RUN: separate actual missing/failed-source, hidden/variant, rotated, delayed ZIP/Open/name GUI cases; broad nested assemblies or print-direction behavior; new numerical V/C/general geometry/raster certification; whole-kernel, production build, CI, mobile, release or develop integration. Controlled already-placed mesh coordinates prove writer forwarding, not native transformation correctness. The actual native movement and source edit are separately read back. Broad #538/#539 requirements remain unmet and their epics stay open. Whole CAD/core stays NOT_MEASURED. Next MAIN D524/P0-R04 establishes renderer equality correctness and native reachability separately.

## Reproducible commands

From apps/cad-studio with Node22.19.0. Every heavy execution is serial under gate.sh acquire heavy60, released on exit. Freeze all worktree writers for actual Studio. Use new external output directories.

```sh
TEST_CONCURRENCY=1 node scripts/test.mjs three-mf-export-ownership
TEST_CONCURRENCY=1 node scripts/test.mjs three-mf-export-ownership step-export-preparation
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/three-mf-current-assembly-browser.mjs
node --check test/placed-worker-reply-scheduler.mjs
D523_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/three-mf-current-assembly-browser.mjs /tmp/barocss-d523-studio-repro03 --expect=repro
D523_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/three-mf-current-assembly-browser.mjs /tmp/barocss-d523-studio-fixed01 --expect=fixed
git diff --check
```

The original qualified baseline predates the fixed-only tail; its unchanged runtime producer and tool capsules remain pinned. qualification.json pins logs, receipts, reviewed screenshots, files and independent reader outputs. Raw evidence stays outside Git. Hashes establish custody, not physical accuracy.
