# #431 long-running AI chat: rule and memory growth (PARTIAL: 3 of 4 arms)

Rerun (repo root): `PW_DIR=... CHROME=... node scripts/long-chat-431/run.mjs <virt 0|1> <gc 0|1>`
(env N=2000 INTERVAL=20 UNIQUE=3; BARO_DIST defaults to ~/.barocss-ai/v3/integration/.../barocss-browser/dist/cdn).
Messages: top-level blocks of the #364 recordings (outputs-tw) + 3 generated arbitrary classes per message
(open vocabulary, worst case). Virtualisation keeps the last 50. Runtime option: `gc` (default true), gcGraceMs 3000.
Host load ~9-11; timings report-only. Rules = CSSOM rules across all sheets (nested counted).

| arm | rules 500/1000/2000 | heap MB 500/1000/2000 | <style> 500/1000/2000 | ms/msg 100 -> 2000 |
|---|---|---|---|---|
| virt, gc on  | 867 / 999 / 948 (516 after 8 s) | 5.0 / 5.4 / 5.4 | 51 / 78 / 133 | 5.3 -> 4.7 |
| virt, gc off | 1866 / 3366 / 6366 | 5.4 / 6.4 / 8.3 | 57 / 94 / 163 | 5.2 -> 4.6 |
| no virt, gc on | 1866 / 3366 / 6366 | 8.3 / 9.4 / 12.9 | 57 / 94 / 163 | 4.9 -> 164 |
| no virt, gc off | NOT RUN (paused by coordinator) | | | |

Findings
- GC + virtualisation: rules bounded (plateau ~520 settled, ~950 in flight); 5,850 classes reclaimed. Heap flat.
- GC off: rules grow linearly (3 rules per message = the unique classes); heap grows slowly (~2 KB/msg).
- No virtualisation: nothing to reclaim (all messages live), so growth is inherent to the content, not the runtime.
  The per-message cost blow-up (164 ms at 2,000) is unattributed: likely page layout/style recalc of 2,000 live
  messages plus 6k rules; not separated from runtime work (a bare no-runtime arm would decide it).
- <style> elements are NOT bounded even with GC: 133 at 2,000 while rules are ~950. Reclaimed rules leave
  partitions (maxRulesPerPartition 50) that are never merged/removed, and new rules open new partitions.
  Growth ~1 element per 15 messages here. Candidate minimum gap (BAROCSS, not built): reuse/remove emptied partitions.

Left: arm no-virt/gc-off; a no-runtime baseline for the no-virt cost curve; confirm the <style> finding against
StylePartitionManager source.
Tentative conclusion: docs recipe (keep gc on, virtualise long chats) + one stated runtime gap (partition reuse).
