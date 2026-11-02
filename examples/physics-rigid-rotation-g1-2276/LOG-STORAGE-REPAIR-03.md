# G1a fixed log storage repair 03

Status: AUTHOR_READY, runtime NOT_RUN. The parent preserved revision02 and its High NO_GO_LOG_METADATA_BOUND at commit3df2e7922 before this edit.

Only command() log storage and its existing build-partition charge changed in repair-campaign.mjs. The plan describes that delta. No candidate, overlay, reference, contract, cases, numerical gate, call ledger, production file, or old Ready/review was edited.

The old handler retained one copied Buffer and one array slot per positive chunk. A1MiB byte cap could therefore leave1,048,576 chunk objects for1-byte chunks. The revised handler has exactly two preallocated1MiB buffers, one stdout cursor, one stderr cursor, and the original shared captured-byte counter. It retains no incoming chunk, view, chunk list, or other per-chunk object.

For every data event, let K be capturedBytes and C=1MiB. The copied length is min(data.length,max(0,C-K)). Copy directly into the selected fixed buffer at its cursor, then advance that cursor and K by the same length. Initially both cursors and K are0. Thus cursor(stdout)+cursor(stderr)=K<=C remains true, and each cursor is between0andC. These bounds are asserted before writing. After capacity is exhausted, no retained object is created. The existing overflow path still stops the same child. Metadata/storage count is constant, independent of chunk count.

After close, each raw file gets a bounded subarray view of the corresponding fixed buffer. There is no Buffer.concat. Successful stdout is decoded once directly from its valid range. Fixed log storage is2MiB; at most1MiB stdout bytes imply at most2MiB UTF16 payload for that decode. Before spawning/allocating and after closure the command checks actual build-tree bytes+4MiB<=the existing16MiB build partition. World8MiB, reference8MiB, evidence16MiB, reserve16MiB and overall64MiB limits remain unchanged. This is a logical owned-data/artifact envelope, not measured tool/V8 process heap or RSS.

PID, exit, signal, EOF, timeout, original first-failure behavior, and bounded raw failure log writes remain. The command row adds actual captured stream lengths, fixed allocation/decode allowance and retainedChunkObjects0. No retry or extra command is added. All4build-child/1reference/20World/1708step-attempt counts remain frozen.

Author checks only: heavy gate g1-log-storage03-author; Node22 --check repair-campaign.mjs exit0; source/JSON metadata assertions exit0. Gate go after0s, load15.54, slot1of2. The source check confirms exactly two Buffer.alloc(MIB), direct data.copy, no retained logs.push, no Buffer.concat, cursor-sum/shared-cap assertions and one stdout decode. It does not invoke command(), synthesize chunks, import a provider, convert fixtures, build, or execute reference/math/World code. No author check failed in this revision.

Parent High narrow review and a fresh execution freeze are still required. The existing compile failure and High resource NO_GO are preserved. STOP after READY.
