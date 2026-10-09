# FLUID-05c: high-drop camera framing

Issue: https://github.com/barocss/barocss/issues/909

## Same state, different view

The local merged parent `60734bb81999163918078e9461e6345a15344fef` uses the ordinary release camera for every scene. The actual 640×480 Chromium 155/WebGL2 high-drop visual-v2 [before capture](physics-909-before-splash-v2-step-0.png) clips the top of the 0.85..1.20 m particle block. The first frozen high-drop camera candidate, eye `[1.45,1.35,1.9]` m and target `[0.35,0.65,0.25]` m, produces the [after capture](physics-909-splash-v2-step-0.png) with the full block and four CAD floor corners inside the canvas. Both captures report 256 particles, step 0 in Physics and Viewer, identical raw metre SHA-256 `00bf5a47249e94db4abebdebb6dac0e5ab745b357f1a92bdc3ba22db69eba04a`, density error 0.0970906 and GL error 0. The accepted ordinary release camera stays eye `[1.25,1.1,1.45]` m and target `[0.35,0.42,0.25]` m. Both cameras use Y up, 45° vertical FOV, 0.01 m near and 10 m far.

## Browser receipts

The actual source host used built CAD/GPU/Viewer packages and bundled the Physics source. The captures pair the displayed step, 256 particles, raw position SHA and diagnostics. Visual inspection found the upper initial block and all floor corners within the canvas in both high-drop modes. Release frames retained the accepted framing. Every row had matching Viewer/Physics step, GL error 0 and no browser console errors or warnings.

| Scene | Step | Raw position SHA-256 | Mean absolute density error | Capture |
| --- | ---: | --- | ---: | --- |
| High-drop v1 | 0 | `00bf5a47249e94db4abebdebb6dac0e5ab745b357f1a92bdc3ba22db69eba04a` | 0.09709 | [PNG](physics-909-splash-v1-step-0.png) |
| High-drop v1 | 60 | `33aa6e732073ffecfd7a51f1a16a59b40766619291ab9e64e839dcd51be86341` | 0.20544 | [PNG](physics-909-splash-v1-step-60.png) |
| High-drop v1 | 240 | `a3f1f0b785bf871bfcbef1da600a937c8e9251e2617837dbd5807f5850a572cc` | 0.02233 | [PNG](physics-909-splash-v1-step-240.png) |
| High-drop visual v2 | 0 | `00bf5a47249e94db4abebdebb6dac0e5ab745b357f1a92bdc3ba22db69eba04a` | 0.09709 | [PNG](physics-909-splash-v2-step-0.png) |
| High-drop visual v2 | 60 | `b053a4c578e876225ba621eaedd30def2f4461b5012728eca8e13cf5d59eb29e` | 0.14396 | [PNG](physics-909-splash-v2-step-60.png) |
| High-drop visual v2 | 240 | `d8edda0487697b5464ce5033a269a6e713cb4605d86aa53bf8c30804851a9d8c` | 0.01715 | [PNG](physics-909-splash-v2-step-240.png) |
| Release v1 | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-909-release-v1-step-0.png) |
| Release v1 | 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | 0.01529 | [PNG](physics-909-release-v1-step-240.png) |
| Release visual v2 | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-909-release-v2-step-0.png) |
| Release visual v2 | 240 | `772c8d5b613bff311ec1ab2a40d9965a52ab026fb413771a77dde120be0c9dac` | 0.01642 | [PNG](physics-909-release-v2-step-240.png) |

The same browser session passed scene selection, Play/Pause (step 6), exactly one fixed step (7), Reset to the frozen step-0 hash, forced WebGL context loss (controls disabled) and restoration to step 0. The final app source was restored after the parent-camera comparison, and a fresh step-0 screenshot matched the accepted high-drop PNG byte for byte. `git diff --check` passed. This is isolated sample evidence; #818 needs a new pinned merged-head visual acceptance after serial Integration. The CAD floor remains display-only, and this camera change does not certify CFD or arbitrary particle counts.
