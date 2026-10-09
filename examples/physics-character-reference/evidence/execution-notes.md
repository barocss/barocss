# First failures and working execution

The affected original Physics build passed while the new contract/example was untracked. This initial build is distinct from the final clean-source build.

First harness execution stopped in an independent reference control: the synthetic actor omitted velocity/spin fields needed by diagnostics. Root added those zero control fields only. Second control execution expected exact0distance from a100step numerical convex search and observed4.163336342344337e-17m; root used the same1e-12reference comparison tolerance as its other analytical controls. Both failure reports are preserved. No primary scene/Physics parameter or product-quality threshold changed.

First complete dirty flow then passed the harness. REST/FLAT passed; STEP10 crossed but tilted89.95degrees, SLOPE15 progressed1.9293m and tilted77.06degrees. Review required peak positive slope progress (including first excess), explicit contact-free horizontal reference and known corner/rotated-OBB distance controls. Root added those proof checks, plus explicit includeSensors:false for the frozen foot query. These did not change raw dynamics or servo.

Worker owns the fixture/scene; root owns independent metrics/runner/consumer/evidence. Read-only helper executed no tests/performance. Canonical run follows at a clean source commit after helpers finish. No controller or new API was implemented.
