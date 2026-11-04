---
work_id: physics-sample-gallery-2276
artifact_type: verification
status: bounded_six_samples_public_api_and_hidpi_pass
owner_role: independent-physics-algorithm-work
source_request: continue the Physics library, explain usable scope and test varied samples
last_updated: 2026-11-04
---

# Six public World samples

Branch `codex/physics-sample-gallery-2276` starts at `f17bd7ef3`.
The numerical library is the real public `createPhysicsWorld` implementation,
using authenticated strict Source and actual canonical build03. This stage
adds library consumers, independent references and a real Viewer gallery. It
does not change a production solver or public export, or claim a fresh library
compiler run. Build03's compiler provenance remains a prerequisite, separate
from this stage's fresh public execution and browser bundling.

| Sample | Observable behavior | Primary steps |
| --- | --- | ---: |
| projectile | Horizontal and vertical ballistic motion |64|
| elastic-box | Gravity-driven impact and upward rebound |64|
| sphere-roll | Friction reduces slip and produces rotation |64|
| sphere-ccd | One actual high-speed head-on CCD event |1|
| principal-spin | Angular impulse on a rotated anisotropic box before contact |64|
| coupled-two | Falling upper cube joins supported lower cube and floor |128|

Planned per Source/Native graph: six primary Worlds/385 steps, six exact-repeat
Worlds/385 steps, six independent analytic references, six typed command
refusals with complete owner retention. One extra Source negative observer
control must reject terminal projectile X shifted by1e-4m. Repeat determinism,
independent physical accuracy and Source/canonical word parity are different
checks. Fixed tolerances, inputs, failure classifications and bounds are in
NUMERICAL-CONTRACT and RUN-CONTRACT before execution.

The desktop prerequisite is every numerical sample PASS on the same provider.
Planned desktop: six actual scenarios/385 steps, seven Worlds including one
zero-step reset, complete Native packet/word comparison, actual Viewer/GPU
pixel changes, owned DPR2 context and three desktop widths. No mobile. Expected
trajectories are not physics inputs or GET-served display animation.

All existing HOLDs and earlier failures remain. In particular, the three-cube
long-horizon engine refusal490 and earlier observed478/488 instability remain
NO_GO. A single high-speed event is not a qualified CCD trajectory. None of
these fixed samples qualifies general CAD contact, connected mechanisms,
cloth/fluid physical coupling, moving8 or equipment/manufacturing prediction.
CAD React belongs to another Work. No deployment or release.

Actual numerical/API result: **PASS**, receipt `gallery-api-01`,15033.194625ms.
Each graph executes12Worlds/770accepted steps;385primary steps independently
pass in six reference replies. Six typed invalid commands retain full owner,
then valid runs proceed. Repeat JSON/ALLwords and Source/canonical parity pass.
One extra Source observer-negative reply correctly rejects the1e-4m terminal
X perturbation as PHYSICAL_NO_GO; it is an intended control, not engine failure.
Source integrity is PASS; no production source or tolerance changed.

| Independent maximum residual | Measured | Gate |
| --- | ---: | ---: |
| Projectile discrete position |1.510e-15m|1e-10m|
| Projectile velocity |4.341e-16m/s|1e-11m/s|
| Elastic-box impulse |7.406e-15Ns|1e-10Ns|
| Rolling angular velocity |6.979e-16rad/s|1e-10rad/s|
| Rolling slip |4.832e-16m/s|1e-10m/s|
| Sphere CCD TOI fraction |1.992e-17|1e-12|
| Principal angular momentum |9.842e-16Nms|1e-10Nms|
| Coupled velocity projection |3.192e-16m/s|1e-10m/s|
| Coupled representative face/bounds |2.221e-16m|1e-12m|

Rolling reaches the analytic no-slip regime by step18. Sphere CCD entry time
is.0045s; the engine discards the remaining step time, and only this one event
is qualified. Projectile actual terminalY is2.649666666666667m atT64/120s;
continuous ballisticY is2.6714666666666664m. Continuous position error is
.021799999999999563m, matching first-order kick-drift defect.0218m. Tiny discrete
algebra residuals above do not mean millimetre continuous-trajectory accuracy.

Current package dist's121runtime modules match the paid canonical module bytes:
`gallery-dist-binding-01` PASS113.241ms,0World/reference/compiler calls. The
reusable `dev.mjs` uses this dist only and fails with a build instruction when
absent; it does not require local paid-receipt paths, install or auto-build.
First actual desktop `gallery-desktop-01` **FAIL**6792.022042ms:
`actual uniform HiDPI backing`,2Worlds/0accepted steps,0page errors, source
integrity true and owned context/CDP closed. The observer awaited DPR but not
DOM/client and Viewer size convergence after viewport resize. Original UI,
contract, result, build metadata and owner receipt are preserved in
`baseline/desktop-first-01`; the complete original output remains. The fresh
02driver waits for DPR+DOM client dimensions+Viewer/native backing agreement,
then uses the same exact formula,10s timeout,pixel thresholds and4MP/4096 caps.
No library, physical input or display code changed. New build02 PASS1204.056209ms.
Fresh `gallery-desktop-02` **PASS**12247.983334ms:7Worlds including zero-step
reset,385accepted steps, six complete Native packet captures and zero
page/console/network errors. Real owned DPR2context/CDP close cleanly, source
integrity true. All three desktop sizes and DPR1→2 preserve full physical
owner. Whole retained proof4228400B before final receipt, under16MiB.

| Sample | Initial blue sample pixels | Actual initial-to-final changed pixels |
| --- | ---: | ---: |
| projectile |34843|47451|
| elastic-box |3308|451|
| sphere-roll |887|1277|
| sphere-ccd |162|765|
| principal-spin |1173|1895|
| coupled-two |2951|1753|

These are bounded640×360observations of the actual native GPU backing, not
640×360native rendering. Original>100initial blue and>10changed thresholds
remain. Root viewed actual projectile,rolling,CCD andprincipal-spin screenshots.
Accepted poses/mesh corners use separate unit/quaternion checks; screenshots
are not the numerical oracle. No CAD-native provenance or private GPU buffer
claim. Current preview serves the prebuilt02bytes at http://127.0.0.1:53050/.

Reusable `dev.mjs` also actually bundles and serves all six literal models plus
four nonempty assets from current compiled Physics; its POST capture route is
absent. `gallery-dev-smoke-01` PASS481.243708ms, child stopped cleanly,0World/
browser/library-compiler calls. All121runtime module bytes were separately
bound to the paid canonical copy; this HTTP/build smoke is not another browser
or physical qualification. `gallery-source-syntax-01` PASS271.264084ms on nine
initial JavaScript sources; later dev entry is parsed by its actual build smoke.

Current next engine dependency remains the independent onset-of-drift and
contact/velocity/position coherence work described in
`../physics-contact-convergence-2276/POST-490-DESIGN.md`. Sample availability
does not close or reorder that numerical dependency.


Actual commands (installed Node22.19.0/Python3.13; existing lane and180s owner
wrapper for bounded checks; no install/download):

```sh
node examples/physics-sample-gallery-2276/run.mjs api-01
node examples/physics-sample-gallery-2276/dist-audit.mjs dist-binding-01
node examples/physics-sample-gallery-2276/server.mjs --build gallery-desktop-02 \
  --numeric examples/physics-sample-gallery-2276/evidence/api-01/result.json
node examples/physics-sample-gallery-2276/server.mjs gallery-desktop-02
node examples/physics-sample-gallery-2276/browser-run.mjs gallery-desktop-02
node examples/physics-sample-gallery-2276/dev-smoke.mjs dev-smoke-01
```

A user can run `node examples/physics-sample-gallery-2276/dev.mjs` with current
workspace dependencies and built Physics dist. No paid receipt is required by
that development entry; a missing dist is refused with the existing package
build command. This makes a reusable library sample rather than a replay of
the saved answers. Source ownership, supported finite physics, package runtime,
standalone host, UI observation and real-equipment validation remain distinct.

Documentation: `gallery-docbuild-01` PASS10663.5055ms via existing VitePress,
`gallery-docsite-01` PASS134.445375ms via scoped site checker. Six pages,
968links,274anchors,33snippet regions and14historical copies are validated;
ROADMAP and its built public copy remain byte-identical. Network link probes
NOT_RUN. Existing dependencies only; no deployment. No Physics package source
changed in this sample stage. Archive roundtrip is a separate file-I/O gate and
cannot upgrade a numerical, product or historical NO_GO.
