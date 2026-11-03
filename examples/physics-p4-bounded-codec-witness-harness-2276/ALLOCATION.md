# Native harness explicit allocation

Combined declared ownership is64MiB: parent outer24MiB, child proof32MiB, shared transport8MiB split parent4MiB/child4MiB. This is explicit data, not runtime heaps or RSS. The native core ALLOCATION.md guards its32MiB proof reservation separately.

The Python wrapper checks original request/prepared compact states/legacy model before proof, and adds returned kernel, priced model and full reply for the post-call outer24MiB check. Node receives raw problem/result only. Immutable sources, counters and code are not numerical model inputs.

Parent transport bounds one outgoing line, one returned line, stderr<=64KiB and one decoded envelope within4MiB. Every line<=2MiB. The last successful write clears the outgoing bytearray backing before reply retention. Before dense JSON parsing, reserve192B per syntax token +4B per raw byte +1MiB control/scratch within4MiB, then check the actual shared-reference object graph. Child has its separate4MiB simultaneous wire reservation. A near-cap envelope may refuse; do not increase a limit.

Main harness audits after the B worker has closed, so its full request/oracle/reply/kernel/model comparison graphs do not coexist with live child proof scratch. Per-file JSON preallocation and actual retained traversal still refuse above64MiB. Evidence includes every wrapper file, RPC stderr, process receipt and audit in the same16MiB stage allowance, preserving64KiB terminal reserve.

Tool pin helpers use64KiB streaming hashes. No110MB Node binary transient is allocated. Commands use floor remaining milliseconds and inherit the outer census process group. Bridge cleanup kills/waits only its exact Node PID. RUSAGE_CHILDREN is sampled immediately before the one worker spawn and after close+wait; authoritative child lifetime CPU is rounded upward to integer nanoseconds. Parent startup/serialization/parse/close occurs within first/last context CPU timers.

The old V1/V2 source/evidence remain unchanged. Their reported retained-data peaks measured frame graphs; do not extend them to authentication-transient or process RSS claims.
