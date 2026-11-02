# G1c first failure and bounded continuation

Parent authorizes a corrected continuation under the same physical gates and
resource ceilings. The original `EXECUTION-FREEZE-01.json`, saved harness in
`first-failure-inputs/frame-campaign-01.mjs`, four raw artifacts and command-run
receipt remain unchanged. Original status is FAIL.

The first run constructed one Source World, read it, accepted one step, passed
the independent b01 audit and returned from World disposal. Its test harness
then detected `staged observer/control leak`: the private test observer needed
an explicit `g1Control.release(world)`, which the harness omitted. That observer
is not part of the production API. The owned process exited. No physical gate
failed; no Native provider or second case ran. This is an actual harness cleanup
failure, not a completed first campaign.

The correction calls cancel/release in the owned finally path after disposal.
It authenticates the old summary, raw Source b01 input/before/after/private data
and successful independent audit. It checks that the historical sole failure
is the specified cleanup failure, with disposal returned. Reuse that physical
observation and independent audit as DATA. Do not reload or step its old Source
case. Seed only the saved b01 Source parity record. Run the other seven Source
cases and then all eight Native cases. Current calls are exactly 15 constructors,
15 initial reads, 15 steps, 15 disposals, 15 private observations and 15 independent
audits. The combined physical population is still eight cases per graph.

New private observer releases must all return; require no pending observation,
armed fault or owned observer at each case exit. The old cleanup failure remains
FAIL even if this continuation passes. Report composite physical evidence and
15 new successful lifecycle paths separately. A successful continuation does
not change the original production gyro NO_GO, other first failures, limits,
HOLDs, full admission or downstream adoption requirements. No tolerance,
iteration count, reference process timeout or resource cap is increased.
