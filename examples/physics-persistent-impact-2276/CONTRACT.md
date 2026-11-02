---
work_id: physics-persistent-impact-2276
artifact_type: contract
status: ready_for_build
owner_role: independent Physics Work
source_request: Continue the engine roadmap with desktop rendering verification
last_updated: 2026-11-03
---

Continue G2/P05 from7d0764c95. Fix the persistent box manifold's admitted nonzero restitution meaning. The discrete contact law remains strict closing speed>0.5m/s and minimum material restitution. No iteration, threshold, admission, public model/API, legacy-path or tolerance change. No previous failure evidence is edited. Studio/manufacturing/equipment and old-worker HOLDs remain. No new dependencies/downloads, security changes or deployment.

Supported qualification subset: one centered axis-aligned unit cube against a finite static floor, or two equal centered unit cubes colliding along one principal axis, primitive COM inertia, zero friction, zero gravity for impact. Additional sustained zero-restitution gravity support is a separate regression. Restitution reference is Newton's velocity ratio plus linear/angular momentum and kinetic-energy balance, not the iterative contact formula. Pre-step represented input words and public states/contacts are saved. SI/right-handed XYZ/XYZW; dt1/120s unless a separately recorded1/60 or1/240 matched impact control. Public persistent max4 and existing8 inner iterations/outer passes stay fixed.

Stage A: one actual old compiled public World/step first, speed2m/s, moving mass2kg, floor e0.25/body e0.8. Expected outgoing upward speed0.5m/s, normal impulse5Ns, energy0.25J and zero spin. Preserve physical NO_GO and old numerical provider/source before edits. Source baseline duplication unnecessary. If it already passes, reassess before implementation.

Stage B: freeze normal target speed once for each manifold point before any warm-start impulse for that pair; keep it for all existing inner/outer solver passes in that step. Targets are candidate-only state, not persistent warm caches. Capture all targets before applying any point's warm start. No repeated restitution from already solved velocities. Unknown/known failures must retain state, clock, cache behavior and recorder log. Existing executable internal diagnostic caller transitions must be explicit; archived sources remain untouched.

Stage C: Source and genuine strict NodeNext/canonical root/replay. One-step finite tests cover immediately below/at/above0.5 represented binary64 closing speed, zero/unit/minimum/unequal restitution, reversed model/ID order, closing/separating/resting, X/Y/Z impact controls, equal-mass dynamic pair, three dt controls. Each graph budget≤48 Worlds,≤1024 accepted steps,≤16MiB evidence. Repeat baseline deterministically, actual recorder save/restore/continue, known/unknown refusal retention plus retry/control, and256-step gravity support at e0 as selected regression. No full8-box rerun. Existing focused persistent/CCD regressions only if affected, not successful historical full campaigns.

Gates frozen before execution: public velocity/omega/normal impulse/linear and angular momentum residual1e-10 SI; geometry gap1e-10m; kinetic-energy balance1e-10J; tangent impulse1e-12Ns; Source/Native state parity after graph identity normalization. Exact threshold branches must select the expected positive/zero bounce with no comparison epsilon. A failed1e-10 gate remains FAIL; do not increase iterations or loosen it. Distinguish represented local law from general simultaneous impacts, tilted/coupled contacts, persistent friction and P4 eight-box settling.

Stage D only after C: dedicated desktop scene with actual public World/recorder and public GPU Viewer box display proxies, one SI→mm transform and accepted XYZW, starts paused. Verify hit/outgoing motion/contact impulse display, genuine mesh pixels, camera/resize, step/play/pause/reset/record clock at1280/1440/1920; no mobile. Screenshots prove rendering only. Render baseline and current numeric curves do not claim exact real equipment. Preserve any first render failure. Local preview may remain; no deployment.

All build/numeric/browser processes use existing heavy gate and180s command wrapper; fresh receipt IDs, immutable inputs, first-failure stop on dependent stages. Oracle algebra is bounded closed-form, no ODE/download. G2 other friction/projection/CCD limits and P4 NO_GO remain open. Each phase records changed paths/commands/counts/numeric maxima, remaining limits and next dependency before a local commit.
