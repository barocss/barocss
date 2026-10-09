# Public Physics error entry result (#1022)

The four existing exported classes now agree in one own package graph:
root, /cloth, /fluid and /fluid-cad. This is the new bounded consistency
contract. The old compiled mismatch was not a promised-identity failure in #1010.

Parent: ab81aacade3def44e1736ab0b935a8f6b72278ae.
Clean baseline harness: 31b0e35f3e72f0d152ea35894a79a2cf80699c50.
Clean measured fixed source: 3807229443f0f5de1c2b035e995a341913e1d705.

Before the repair, root differs from the three subpaths; the three subpaths
agree. The baseline still passes all actual own-class errors and state checks.
After the one build flag, all constructors and genuine error instances agree.
No kernel, type class, API, source export or published map was changed.

| Actual consumer | Own src inputs | Own dist inputs | Four constructors equal | Genuine errors checked |
| --- | --- | --- | --- | --- |
| Source, ordinary public imports | 186 | 0 | yes | 6 |
| Compiled, complete transitive published maps | 0 | 162 | yes | 6 |

Each flow takes one cloth step, observes step1/289vertices, disposes and catches
a genuine DISPOSED error. The live rigid invalid dt retains complete accepted
state. Malformed root/cloth/fluid/fluid-cad inputs produce actual INVALID_CONFIG
errors. Codes, names, exact messages and absent-cause behavior match the baseline.
All six errors are instanceof all four references after the repair.

All six published JS/declaration entry targets exist (12files). The actual
compiled resolver records five public resolutions, including transitive CAD.
These are resolver inputs; no CAD operation or fluid simulation was executed.

Physics baseline build and final clean-source build pass. The first fixed build
ran with an uncommitted flag; its log is separate from the canonical clean build.
Syntax, scoped manifest comparison and read-only review pass. One existing
joint-demo browser bundle consumes both Physics dist/index.js and dist/types.js.
This is module resolution evidence, not new Viewer pixels, hardware timing or
numerical acceptance. Known existing hosts bundle the library before HTTP.
A direct compiled-root server must provide the sibling types.js module.

The final child adds saved receipts/results only. #1022 remains OPEN until sole
Integration adopts this exact delta and records the affected build plus short
public consumer receipt. No version/realm/independent-bundle identity, whole
numerical campaign, archive/package publication, product push, PR or release.
