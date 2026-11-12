# D872 — Choose ordinary object snap kinds during a sketch command

P1, rows 09 and 20. FEATURE. The sketch panel has one collapsed control for Endpoint, Midpoint, Centre, Quadrant, Origin and Edge crossing. The app session starts with all six enabled. The control takes effect on the next input. The viewport filters ordinary candidates before its existing strict 8 CSS pixel comparison. It clears the previous cue on a setting change. Current grid settings have a separate **Grid snap** control. Dedicated Two-point and Arc Extension tools retain their own pick paths.

Circle and Slot now calculate the final radius from the current click target, using the same rounding as their hover previews. Slot also uses the current click to check whether its second centre differs from the first. This allows a keyboard filter change between hover and click.

| Result | Check |
| --- | --- |
| PASS | Actual Studio compared the native endpoint at (14.54, 12.3457) mm with the native centre at (14.84, 12.3457) mm. They were 5.568 CSS px apart. Keyboard-disabled Endpoint cleared the cue. A click at the same screen location placed the exact centre with Grid off. |
| PASS | The earlier 3 mm radius circle and the first Rectangle point survived the settings changes. With all object kinds off and Grid at 1 mm, the next corner was (28, 19) mm. With both controls off, a separate Rectangle retained (23.25, 15.75) to (32.25, 22.75) mm. |
| PASS | With a stationary pointer after keyboard toggle, Circle stored radius 6 mm after previewing 7 mm. Slot stored radius 2 mm after previewing 2.5 mm. Line and Spline consumed the current filter, and a live inline dimension draft stayed editable during the toggle. |
| PASS | Toggle kept the accepted document, selection, History and dirty state exact. Finish, first Undo/Redo and a 1,694-byte project Save/fresh File Open preserved the authored geometry and source nodes. New and File Open retained the current session choices. A fresh context started with all six enabled. |
| PASS | A change from Z0 to Z2 cleared the former endpoint cue and retained the filter. At Z2 the native crossing appeared. Disabling it before clicking used the grid point (15, 12) mm, with the offset plane retained in the saved sketch. |
| PASS | Controlled tests exercise each kind, all-off, ties, the strict reach boundary and filtering before distance selection. Actual native edge crossing, offset Two-point and offset arc midpoint regressions passed. Independent source review identified the Circle/Slot final-click and inline dimension custody cases. |
| PASS | Model 18/18, Studio 60/60, both type checks, build, scoped lint and driver syntax. The final desktop runs checked 356, 830, 830 and 830 frozen inputs through cleanup. There were zero page errors, console errors, downloads or source changes. |
| FAIL | The five earlier drivers used an exact accessible name without the unit, expected a rounded coordinate, lost a click outside the canvas after camera framing, put the competing points beyond the screen snap reach, or assumed Escape would clear both selection and the sketch in one step. The final driver verifies the canvas and reach and follows the observed input order. The first Studio type check caught the optional dimension callback. The call now checks its presence. |
| NOT_RUN | Mobile, other browsers, the full desktop browser flow and full package suites. |

The declared scope of [#2388](https://github.com/barocss/barocss/issues/2388) meets its acceptance checks. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
