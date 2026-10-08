# PHYS-12 local Integration verification · 2026-10-08

Local `develop` HEAD `28ebb47ae07e50f4a34959e1fed277298e81f068` passed the frozen offline install, five package builds, all 11 compiled Physics/CAD probes, `git diff --check`, and an isolated consumer installed from locally packed CAD/Physics tarballs. The full measured report is [JSON](release-gate-integration-2026-10-08.json). The fixed 32-body/120-step workload observed 29,760 direct versus 960 AABB candidate calls and matching contacts/poses; this run took 34.631792 ms versus 21.932084 ms. One-run timing and heap deltas are not stable benchmarks.

An actual Chromium WebGL2 Viewer rerun at that HEAD displayed two native Surfaces and two labelled proxies. First contact appeared at step 21, Physics Y 0.13385164807134506 m and Viewer Y 133.85164807134507 mm. Rev1→rev2 refused the stale binding while step, Physics body and Viewer pose stayed fixed. Re-admission reset step to 0 under rev2. Console errors/warnings: zero. Browser session and server were closed.

`integrationVerificationPassed` is true. `releaseCandidate` remains false. This evidence records local verification only; release-candidate designation and publication are separate decisions. The inherited dirty render manifest and kiosk recordings were not staged.
