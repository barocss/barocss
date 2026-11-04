# Zero-World HiDPI protocol probe

Root alone executes hidpi-probe.js through the existing installed Playwright CLI on a fresh about:blank page. It must not run on the application page. Fresh proofID/output directory, explicit source substitution for __OUTPUT__, Root180 guard and ordinary CLI stdout/session cleanup apply. No app/Viewer/Physics module is imported, served, navigated or executed. No browser install/download/startup flags or mobile test.

Exactly four screenshot observations, all about:blank:

1. Original CLI context1280×800: real CDP DPR1→2, then device-scale screenshot and immediate actual DPR re-read. This is diagnostic only; screenshot resetting the original context's DPR is recorded, not hidden or required to pass.
2. A new owned BrowserContext with viewport1280×800/deviceScaleFactor2/isMobilefalse: real CDP1→2, screenshot, actual DPR remains2 and PNG is2560×1600.
3. Same owned page/context resized1440×900: actual DPR2 before/after screenshot and PNG2880×1800.
4. Same owned page/context resized1920×1080: actual DPR2 before/after screenshot and PNG3840×2160.

The actual PNG IHDR dimensions are read directly from screenshot bytes; no mocked devicePixelRatio, screenshot rescaling, tolerance or wait-time increase. Assert exact inner viewport, URLabout:blank, absence of app globals and zero nonblank network requests. If BrowserContext.browser/newContext is unsupported, report NO_GO; do not silently choose another route or load the Physics app. Always detach owned CDP sessions and close only the new owned context, leaving original CLI session cleanup to Root.

A PASS qualifies only the DPR protocol. It authorizes a later driver source revision to keep the original CLI page blank, create the proved default-DPR2 context/page, then navigate that owned page to the actual app exactly once. The formal two512/three384 test would still own3 Worlds/896 accepted after its zero-step reset, preserving all numeric/GPU/proof gates. It does not repair or erase the failed HiDPI01 receipt, alter Root's display or extend the three-body long479 NO_GO. Root must execute the full Viewer test afresh after any driver change.
