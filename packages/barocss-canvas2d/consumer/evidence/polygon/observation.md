# Polygon path builder native observation

Native child parent: verified #925 local develop merge `b23a12106de32960659542966fd03065e6bfa5d0`.

- Node 22 library build passed, bundled `dist/index.js` 177.9 KiB. Strict compiled public consumer type check passed.
- Focused probe passed: point order, nine emitted commands and `Z`, fresh `build()` copies, input mutation isolation, frozen input, 14 invalid Array/point/edge cases retaining prior commands, and one cumulative 256-command `SCENE_LIMIT` refusal.
- Actual Chromium 155/WebGL2 DPR 2: concave U polygon arms `(25,50)` and `(55,50)` were red `[255,0,0,255]` and hit `Polygon`. Notch `(45,50)` was gray `[64,64,64,255]` and hit `Back`; upper bridge `(45,25)` was red. Real pointer at the left arm routed `Polygon:Polygon`, then `stage:Polygon`.
- Rejected incomplete `setPath` returned `SCENE_LIMIT` and retained the prior commands and sampled frame. Browser Save downloaded a 923-byte [v1/Scene v17 document](document.json), SHA-256 `78e4a064ab72569403b10c56a97b675e218cf4bfb652dbfb1573e6b77879c6c3`.
- File chooser Open staged the document on a new canvas, renderer and tree. Generation 2 repeated pixels/hits and a real pointer reached the restored Polygon. Editing the restored handle to widen its notch changed `(55,50)` from red/Polygon to gray/Back while the left arm and upper bridge stayed red. Browser console errors/warnings: 0/0.

This is one compiled Chromium/WebGL2 consumer. It does not establish general polygon validity, CAD predicates, cross-browser coverage, a published npm artifact or release acceptance.
