## Private capsule face source/input freeze — before builds or trials

Base: `6bd3376d6943a8d84b83ca62b0031a9ec8927bea`; branch `codex/physics-capsule-ccd-1280`. Native owner writes only new `examples/physics-rigid-capsule-ccd-reference/**`.

Complete `source-freeze.json` SHA256: `556ba18d882948b0615b77b148f6bf5551e781221b46172650661f1329c34cb2`. It pins 276 private/reused source and build/dependency files. Input Float64 SHA256: `cbbfb10b9599da9185c0b4b71493f141a3d9b8cbd17f8ddc46a98b7737e4857c`. Runtime: Node `v22.22.0`. Independent oracle SHA256: `eae9fd65ebf3089710eda235d833e17197db709b1e83f5d4961f4c874b4a6f2c`; oracle controls SHA256: `a7b22b1bed37bfcc25e58344a12f91a26e19ef314530285193cbaf33f0c6ac72`.

Private profile: original radius 0.1 m and half length 0.2 m; fixed upright capsule, zero spin; one static finite box; selected **negative local X face**; identity or frozen Y yaw 0.2 rad; head-on/zero/departing translation only. Opposite-side, tangent, footprint/edge/corner, angular and moving-box inputs refuse. Response validates the same admission and supplied hit/witness/normal before returning a detached result. No hit uses tHit=0 plus full remaining time. Stale/error/copy/disposal receipts preserve prior accepted records; unknown reflection/harness exceptions propagate.

Immutable gates: Decimal80/120 difference <=1e-25; time/fraction/centre/witness/face membership/normal/contact gap/post-response gap/closing speed/time accounting <=1e-12 in declared units; full step versus two literal half steps; source/repeat/genuine emitted helper Float64 and field/error/copy parity. Public query remains own 0.15/0.35 profile (nominal fraction 0.2988), and refuses private profile; private original nominal fraction 0.3588. Original parseBody capsule CCD refusal retained; detached geometry-only original detect does not qualify world CCD.

Next actual flow: unchanged original CAD/Physics build script, strict private adapter tsc, then one oracle control flow and source/source-repeat/genuine compiled-original-helper consumer. Emitted dependencies will be hashed before trials. First failing gate stops; no tuning or rerun. Independent numerical failure is NUMERICAL_NO_GO; an unexpected harness/control/build exception is EXECUTION_FAILURE with exact logs, not a physical refusal. No PhysicsWorld construction/step, contact lane, product source edit, product push, PR, deploy or release.

`fullWorldCCDGO=false`, `rigidAngularResponseMeasured=false`, `contactFrictionMeasured=false`. Root owns serial Wiki/handoff/adoption.
