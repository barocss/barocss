# Owned-context HiDPI protocol revision

Fresh run contact-viewer-hidpi-02 supersedes only the failed HiDPI01 browser context protocol. The exact HiDPI01 sources/result remain baseline/first-hidpi-01; its10-second DPR wait timeout is not extended. Low-DPI prefix01 PASS remains separate. Display SHA3136397... and all app/physics/numerical/image thresholds remain unchanged.

Actual about:blank probe showed the original CLI context resets CDP DPR2 to defaultDPR1 on screenshot. The owned context with default deviceScaleFactor2 retained realDPR2 before/after screenshot and setViewportSize, with actual PNG2560×1600/2880×1800/3840×2160. The original probe wrapper FIRST_FAILURE was an expected-status-string mismatch after successful inner protocol/cleanup; it is retained, not rewritten as a PASS. The distinct paid HIDPI_SAVED_PROTOCOL_AUDIT_CONFIRMED receipt verifies original result SHA and four PNG hashes, sourceIntegrity PASS, world/candidate/newBrowser calls0 and originalWrapperFailurePreserved true. Builder requires these exact facts and pins audit source, protocol source/contract, original failed result/guards and PNGs. No probe browser rerun is implied.

```
node examples/physics-contact-convergence-2276/server.mjs --build contact-viewer-hidpi-02 --dt examples/physics-contact-convergence-2276/evidence/dt-02/result.json --long examples/physics-contact-convergence-2276/evidence/long-01/result.json
node examples/physics-contact-convergence-2276/server.mjs contact-viewer-hidpi-02
node examples/physics-contact-convergence-2276/browser-run.mjs contact-viewer-hidpi-02
```

CLI opens about:blank controller, zero app/World. Checks create one owned BrowserContext {viewport1280×800,deviceScaleFactor2,isMobilefalse} and its page. Target listeners are installed before the sole actual-app navigation. Actual app still creates World1, zero-step resetWorld2/two512 and selectWorld3/three384; formal3World896/nine exact Native captures, no extra Physics warmup/test. CDP1→2 and DPR2 three widths, exact native clamp/backing checks and normalized native-pixel observer remain as HiDPI-CONTRACT. Browser screenshots/setViewport restore the proved default2 instead of1. No mocked DPR, mobile mode, timeout/cap/tolerance increase or renderer fallback.

Target screenshots, public Viewer states and a failure observer are captured inside the owned target page before context close. On failure an actually running target is paused through its existing UI before observation; no synthetic World state is supplied. Errors retain the original target cause. Target CDP session is detached and only owned context is closed. CLI final snapshot is explicitly controller-only/about:blank, never substituted for target evidence. Original CLI session closure remains Root's driver responsibility. Successful receipt requires owned context closed and CDP detached. Physical long479 NO_GO and all previous failed/NOT_RUN statuses stay unchanged.
