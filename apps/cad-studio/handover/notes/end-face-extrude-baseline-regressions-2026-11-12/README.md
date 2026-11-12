# D851 — Replay the affected bracket and enclosure profiles

P1, rows 06, 08 and 16. SMALL. The original temporary files were absent. The tracked test literals reproduce both byte lengths and SHA-256 pins exactly. The runners accept an explicit absolute input path and still check the original pins. The product source did not change.

| Result | Check |
| --- | --- |
| PASS | B01 starts with the complete accepted W60 bracket. Studio edits W60 to W80, refuses R1000, cancels, and executes first Undo and Redo. A real Measure pick reads 76 mm on the named edge. The saved W80 opens exactly after reload. The post-Open W60 edit measures 56 mm on the same named edge. Nine states pass the retained native and independent numerical checks. |
| PASS | B02 starts with the W80/Wall3 Shell. Studio changes Wall to 2 mm, creates the Box rail, performs ordered Union, picks the rail top for three through holes, and applies R1 to four picked vertical edges. Width changes to 90 mm and Wall to 3 mm. Width4 is refused by Shell. The exact accepted Doc, body and history survive. First Undo and Redo, exact project Save/Open, and the post-Open change from three holes to two pass. Twelve states pass the retained native and independent numerical checks. |
| PASS | The B02 refusal has one matched actual Worker request and reply. The independent native read of the exact rejected input identifies Shell n2. Root checked the original screenshots. Both final runs have matching source capsules after cleanup, no page or console errors and no downloads. |
| PASS | Model 40/40, Studio 41/41, Model types, both driver syntax checks and diff check. |
| FAIL | The first B01 Measure and B02 Union attempts timed out at the Space palette after control focus. The runners now use the relevant public Model rail buttons. The second B02 attempt looked for a toast. The current product displays the Shell refusal in the feature editor. The final driver opens Kernel detail and checks the actual refusal. |
| NOT_RUN | Original B01 creation and original B02 Shell creation, cold browser process reopen, third-party STEP geometry import, full suites, production build and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) stays open. Source review found a case where reversing a target prism can give its unchanged native bottom name to the other authored end. D852 reproduces the edit in Studio and checks the saved target's original role. Initial scenarios remain **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands, tolerances and receipt digests](qualification.json).
