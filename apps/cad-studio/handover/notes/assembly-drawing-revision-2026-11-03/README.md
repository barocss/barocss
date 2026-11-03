---
work_id: D459
artifact_type: assembly-drawing-revision
status: qualified
owner_role: executor
source_request: "Continue the core CAD roadmap, one bounded category at a time"
last_updated: 2026-11-03
---

# D459 — Assembly drawing revision follows accepted assembly source

One bounded C4-4 workflow, rows 10/11/12/16. Baseline `91de5d72fb7d151ed8f5489bd3b8152eaf6dc2f4`. Small private Studio dependency fix; [qualification](qualification.json) holds exact commands, hashes, first failures and limits. #540 stays open; its broad ENG01–08 criteria are not fully met and no checklist is promoted.

## Reproduced defect and change

The retained actual D457 H12 assembly has two W60×40×12 occurrences sharing part1/RevB and one planar mate. Assembly Drawing at Scale 1 was stamped A. Public POSITION X0→10 on inst2 changed the current native/readonly front width 60→70 and printed SRC `a7649e1ff1c02d7a`→`63c2b7a453394e65`. Yet the saved model marker `741638a5` stayed and the required out-of-date warning was absent (0 instead of 1). Repro02 captured source, stamp and current consumer geometry before the assertion; its product FAIL receipt is `63b6089e3b58306675db5ec8160e05b20fef25d9ab7800421dd2787537531abc`.

The private drawing revision helper now fingerprints conservative assembly source recursively when the scoped document has instances, including an explicit empty array. It retains complete occurrence metadata, embedded/nested definitions, cuts, joint state, rows, outputs, mates and patterns. Known drawing/render/workflow/unaccepted-revision/instruction/underlay/allocator channels are excluded at actual document boundaries. It does not remove similarly named fields inside arbitrary authored node records.

Direct source follows evaluatedPart's exact semantic condition at every nested document: retain it for schema4, an own routeBundles property, or an objectId curve-feature-pattern path; ignore ordinary direct presentation otherwise. Existing canonical serialization and modelPrint produce the issue marker. This is conservative source identity, not geometric equivalence, a universal normalizer or cryptographic integrity.

The D454 ordinary-part branch is preserved literally. The string reader, public Model API, schema, worker/native provider and printed SRC are unchanged. Old insufficient assembly markers remain saved and outdated until the user chooses Next; no automatic migration or restamp occurs. The issue marker and printed SRC are separate algorithms and are never equated.

## Actual acceptance and continuation

Eight groups pass: old A stays saved and warns; manual Next B is current at X0; X10 warns against B; exact Undo/Redo toggles X0/current and X10/warning; Next C is current; paper-only A3 stays current; own OPFS Save/Close/same-context reload/Open retains C; post-Open X0 warns against C. Native observations keep both volumes 28800, first centroid[30,20,6], second[30+x,20,18], and assembly box[0,0,0]..[60+x,40,24]. Definitions, stable references, mate and unrelated drawing fields remain retained.

Run01 passed the first six groups, then its driver waited for Versions while still in Drawing. The continuation switches to Model and opens the exact accepted C/A3/X10 document. Run02 runs only the missing project and post-Open groups; the six passing groups are reused, not repeated or counted twice. Recreating the exact linked H12 source in the owned project is a necessary persistence antecedent, not new source-construction/link-refresh proof.

Nine native/consumer bindings pass: six new captures and three exact-document reuses, with nine independent oracle runs. Reuses require the whole accepted native input and original source/test/helper pins to match; each current readonly consumer oracle runs anew. Bounds/centroids and readonly Scale 1 straight projection use absolute 1e-9 mm; native volume uses relative 1e-9. This is a finite native box/current-layout proof, not general visibility, raster, SVG formatting, standards or overall drawing/physical completeness.

## Checks, failures and cleanup

PASS: 15 focused groups (13 revision helper, including five retained D454 groups, plus two retained drawing commit/roundtrip groups), scoped lint, Studio types and final Model types after the last test edit. High supplied source-policy/math review, one new shifted native/provider preflight and independent oracle. No independent full-tier audit/mutation or full kernel run is added for this small UI-only fix.

The first repro driver failed before the candidate because unscoped Scale matched both a Modify tool and the Drawing select. Repro02 then confirmed the product defect. The fixed workflow's missing-Model-tab harness failure remains immutable; only its two missing groups were resumed. Raw logs, screenshots and native bodies remain outside the repository.

Root viewed seven screenshots. Run01's 2501 and run02's 2661 frozen capsules match after cleanup; root confirmed 2661 current/frozen/cleanup equality. Errors, console errors, downloads and watched source changes are 0. The owned namespace is absent; context, browser and server are closed, own wrappers are gone and leases are released. Final continuation receipt: `b36678567117193d447716c69c6fc219a5bb3f1e101ce6506e7e3ed7d5b121bc`.

Core readiness remains NOT_MEASURED and legacy 43% remains frozen. #2258/#2266, manufacturing, Motion/Physics, schema3/4, owner-gated downloads/dependencies, browser-CI and release HOLDs stay. Next is D460 planning-only issue intake requested by the owner; after it D461 inventories the highest-priority uncovered C1/C2 profile. No automatic feature work or HOLD lift follows.
