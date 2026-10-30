# D346 quadratic CUT browser preparation

Status: DRIVER_SOURCE_PREPARED_NUMERIC_CONTRACT_PENDING. Product tests, build and browser are NOT_RUN. No heavy job ran. Only approved tiny product-import-free Decimal arithmetic fixtures and syntax/lint checks ran. D345 artifacts were not changed.

Owned repository file: apps/cad-studio/test/quadratic-cut-pattern-browser.mjs.

## Actual UI flow prepared

One Chrome, serial contexts. Public Part seed creates stock60x40x10 and the original asymmetric3x5x10 CUT, then stable witness420. Actual Sketch Line from(0,0)to(20,20), numeric point fields, Select and Make curves create a native3pole degree2 unit-weight straight span. Actual Direct Control point=P1, lazy X/Y edits20/0 then create the nonstraight quadratic. The stored source is decoded through public model queries and asserted; no authored hooks or injected curve replace the UI producer.

Existing Path UI performs preview, too-long distance refusal, valid retry/Cancel, Undo/Redo of the last actual source edit to show no command history commit, and retry Apply. Immediate accepted selection/body-order observation fails if the old target index aliases witness420. No hook clears/remaps a pick or silently repicks after Apply. App is unchanged by this lane.

Public/native/Model/actualStudio V/C, native cutter corners, unique stable @k names, disjoint stock-minus-prisms and fixed cutter orientation are checked through an independent oracle. Spacing10→12, live P1 Y0→5, whole-path translation[3,4,0], Undo/Redo, two native Saves/fresh Opens and editable Path/Spacing/Count are prepared. Translation records before/after curves and mass; each current P0-relative shape is independently recomputed.

A pending High-approved API import observes planCurveFeaturePatternPath(raw,spacing,count), owned input immutability, reported length bounds and planned offsets separately from actual native geometry. Root approved that API shape, not yet its final error/work proof. Existing signatures can express unit-domain driver input while the API family may admit arbitrary clamped domains and same finite Z. This driver authors unit domain/worldZ0 only.

## Fail-closed numerical marker

The driver preflight requires numericContract.status FROZEN, an adopted positional authority and finite positive position/volume/centroid budgets before any generation/server/Chrome launch. Those values intentionally remain PENDING_HIGH_ERROR_WORK_PROOF/null. The driver cannot execute as a product qualification until root/High adopt the exact numerical contract and update this owned test source. No new epsilon is selected here.

The embedded oracle is Python standard-library Decimal80: exact represented binary64 input decode, closed-form integral of sqrt(A*t^2+B*t+C), independent bisection, native polynomial points, then exact/Decimal stock-minus-disjoint-prism moments. It imports no CAD code. It is an ordinary-fixture high-precision cross-check, not a certified Decimal interval or universal quadrature/inversion theorem. High reviewed the formula and ordinary noncollinear applicability. The planned driver fixtures10/12 spacing and live edit are still subject to final admission/work contract.

## Executed tiny independent cross-check

Root explicitly approved execution of product-import-free Python fixtures. The three High ordinary curves' Decimal lengths lie inside /tmp/d346-plan/oracle-final.json certified length bounds. All six positions at distances10/20 lie inside the separate High certified balls. Additional distances8/12/16/24 and spacing12/24 material guides were computed as Decimal cross-checks only; no certified ball is claimed for those new distances. The translated live curve has identical represented derivative coefficients, Decimal length and relative offsets.

All three spacing10 and spacing12 guides have three disjoint3x5x10 tools inside the stock, V23550 and independently computed centroid. The frozen High reference hash is ad12d0f8256de8eee448c277baf8d14b4f66701ea887939673210221d2fb4359. See decimal-crosscheck.json, exact source, preserved first stdout/exit and decimal-crosscheck-provenance.json. First mathematical run PASS with no errors. Python3.13.5, Decimal precision80. These observations are not production tests or native geometry PASS.

## Harness and gates

Driver node --check PASS. Saved inspector source syntax PASS. Independent Python oracle syntax compile PASS. Narrow driver lint PASS0errors with one no-console warning. No Studio/Model product source, API, tests or D345 artifact changed. Source caps distinguish initial subset and expanded bundle/Studio graph; virtual stdin contents/hash are saved and excluded from disk caps. Page/console/watch/download errors, screenshots and all owned cleanup are recorded. Root must view images separately.

When final math/source gates are adopted, launch from apps/cad-studio with:

```sh
D346_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /Users/user/Library/pnpm/nodejs/22.19.0/bin/node test/quadratic-cut-pattern-browser.mjs /tmp/d346-studio/run-01
```

Current pending preflight deliberately blocks that launch. No commit/push.
