# PHYS-10 native Viewer checkpoint

Date: 2026-10-08. Local browser: headed Playwright at `http://127.0.0.1:52885/` on the native PHYS-10 worktree. This is a local consumer check, not a release result.

- Viewer WebGL showed both original weighted native Surfaces. The blue moving `rational_panel` stayed above the orange fixed `flat_panel` at contact. The SVG side view showed the separate sphere and box proxies. [Desktop capture](scene-desktop.png).
- The page displayed qualified IDs `part:native_loader_demo.rational_panel` and `fixture:native_loader_demo.flat_panel`, the `rev1` source token, and explicit approximation labels.
- At a paused accepted state after contact, clicking **Change source revision** displayed `rev2` and `Refused stale rev2; Physics and Viewer retained state`. The visible step index stayed 328 during that attempt.
- Clicking **Re-admit proxies** reset the accepted Physics world to step 0, height 0.2800 m and `rev2`, with both Viewer poses reapplied.
- Playwright console reported zero errors and zero warnings after reloading the final page.

Compiled `cad-proxy-probe.mjs` independently measured first proxy contact at fixed step 21 and checked source-byte/revision refusal. The browser revision control changes the host revision token while source bytes stay unchanged.
