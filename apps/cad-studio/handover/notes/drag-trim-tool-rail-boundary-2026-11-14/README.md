# D1058 — cancel a Drag Trim stroke at the tool rail

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Check each captured pointer segment against the current tool rail rectangle in canvas CSS coordinates. Contact cancels the entire stroke and consumes its release. Check sparse segments so the guard also covers events whose endpoints both miss the rail.

- **FAIL** In desktop WebGPU the held preview retained two intervals when the pointer moved onto a line under the rail. Release created a draft Undo step. This fixture reproduced an invalid commit at the rail. It did not measure an extra third interval behind the rail.
- **PASS** The same stroke clears the preview, preserves the native document, selection, history and Undo/Redo controls, and leaves all three lines intact after reframing. A fully visible retry cuts three intervals and one Undo restores all three. Visual review confirms that Trim stays active.
- **PASS** The D876 desktop replay covers cancellation, retry, atomic refusal, Finish, local project Save and fresh Open. Twenty focused checks include sparse crossing and release across the rectangle. Studio type-check, driver syntax and diff checks pass.
- **NOT_RUN** Other overlays, curved intervals, production build, full suites and mobile.

#2455 remains open for other draft tools. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
