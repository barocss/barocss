# D945 — verify two surviving intervals on one Detail diameter source

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** The public `set_drawing` tool refuses to change the center or radius of an annotated Detail with `DRAWING_DETAIL_REFERENCES` and leaves the input intact. Both edits are accepted before a diameter is authored. Studio already exposes paper position and scale for an existing Detail.
- **PASS** Studio opened a separate 5 mm crop centered at (32,18) model mm. Its saved lower Ø8 semicircle has two surviving intervals. The initial position and three pointer drags exercised both clipped endpoints, an interval interior and the seam. The arrow stayed on the saved lower edge when the label crossed to the upper sibling. The source reference and 0.15 mm tolerance were retained through first Undo and Redo.
- **PASS** Four actual SVG/DXF pairs agree with an independent circle-intersection and nearest-interval calculation within 0.0001 paper mm. Tips were (291.0016,101.25), (328.9984,101.25), (329.6013,98.9734) and (330,95). All DXFs retained an 8 mm measurement and a 40 mm definition diameter at 5:1. Model 21/21, Model type check, driver syntax and diff check pass.
- **NOT_RUN** Exact point-contact-only crop and the remaining no-anchor boundary. A source review found that the arc midpoint test may admit a whole interval at tangency. That candidate needs a native and desktop reproduction. Production build, full suites, PDF and mobile were not run. #2322 stays open. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
