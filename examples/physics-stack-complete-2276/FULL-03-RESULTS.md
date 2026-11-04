# Actual OPT08 full03: stopped on cost

Status: NO_GO. Root ran the original complete campaign using immutable actual canonical OPT08, after prefix04 passed. ALIGNED stopped at the scene deadline. OFFSET and YAW were NOT_RUN. No observed physical residual failure is reported; unfinished work does not establish a physical PASS.

The host completed1153 contiguous physical steps, fully verified and archived. The campaign accepted0 and has an empty scenes list because the scene owner did not complete cleanly. These are separate counters; neither is full qualification.

| Host counter | Actual |
|---|---:|
| Requested trajectory steps | 1200 |
| Producer attempted | 1155 |
| Producer returned | 1154 |
| Normal KKT passed | 1154 |
| Fully verified / archived / contiguous physical accepted | 1153 each |
| Record groups including initial state | 1154 |
| Runtime05 body frames compared | 1154 |
| Original first16 record / wire-pair comparisons | 17 / 65 |
| Independently full accepted | 0 |

First observed failure was step1155, gate `producer/structured-clone`, message `producer scene deadline`, unresolved=true. Step1154 world proof was unfinished. Earliest failing step remains UNKNOWN; the producer deadline does not identify an earlier numerical failure.

| Independent reference operation | Attempted | Replied / resolved / passed |
|---|---:|---:|
| contacts | 1154 | 1154 each |
| world | 1154 | 1153 each |
| step-ledger | 1153 | 1153 each |
| quality | 1155 | 1155 each |

The actual step960 baseline was promoted after its contiguous archive commit. There were194 terminal-quality-complete phase steps. This does not qualify the full terminal trajectory or the remaining scenes.

The archive closed with10385 entries and213852828 compressed bytes, SHA256 `234f9b7a7c1b8f0120cfac61262a91b7ba59961214b8b5119f23d092376b1d9d`. Full archive recovery was NOT_RUN (`recovery:null`). Shared retained budget used222383149B of293601280B, with2097152B emergency reserve. The observed stop was cost, not output-cap exhaustion. No compressed-size forecast is made for the unrun scenes.

The owner receipt is CPUUNKNOWN, with `CLEAN_NODE_REQUIRED`. Its observed wall span before final receipt was166.13340325001627s. The host was reaped with exit1. Raw OS wait statistics are observations, not qualified complete subtree CPU. The campaign reports `OWNER_STOPPED`, ownerExit=-9. These recorded statuses are retained as written; no clean CPU PASS is inferred.

Failure evidence preserved the received step1153 frame selected as `EARLIEST_RECEIVED_UNCOMMITTED` at capture. The first candidate1155 was missing. Capture availability was step1153 archiving/returned/record-ready,1154 proof/returned/not-record-ready,1155 unresolved/not-returned. Subsequent final counts include the completed1153 archive commit. The141713B finite-number envelope reports recoverable included words and 42 negative-zero paths. Alias identity is explicitly not restored. No new recovery audit or physics call was made to author this document.

Source binding remains PINS `caa9078c2911ec2aa2687ad51ba5b49af192fdbaa536dfe2303e1eebce4cf1cd`, SOURCE-SEAL `0c42153c4d3624a0fb0fbf05ffebd6bcfbe5b0590c10ce224aa37bbeb0cd4e7f`, actual canonical OPT08 provider aggregate `09e0eaba79ac8b7ac3bfe268849cf72a0d429b54b71032ad63b9ecd8b6479c2a`. The qualified stream-sized archive and qualified failure8 helper remain unchanged. Failed alternative codecs were not adopted.

Small actual receipt bindings:

```json
{
  "ALIGNED/host/failure.json": {
    "bytes": 141713,
    "sha256": "4911e88aacd688d9b27fe96b30d31aa1a990cafa857ae3b278fe4500a766c46a"
  },
  "ALIGNED/host/result.json": {
    "bytes": 5188,
    "sha256": "b39c42beab3b4a69714c36b5207885f4e171c36458259445ec9e68d8c88c5a49"
  },
  "ALIGNED/summary.json": {
    "bytes": 1436,
    "sha256": "031a8e36ac9a494a277d00c26c1eb52e9948b404b4191f1dd26edd9a351860f1"
  },
  "budget.json": {
    "bytes": 53,
    "sha256": "ad620dfbe0f4be9808fbc84aa13cbb085f1eafb453a962d079d3f8f59904bfff"
  },
  "campaign-result.json": {
    "bytes": 776,
    "sha256": "636e700e5c6add1160e1d105038c145e3986ba28cbcb63cbe8ebe09b51a0c337"
  }
}
```

Original independent full physics remains false, independentFullPhysicsSteps0, API=false, publicWorld/desktop NOT_RUN. Optional strict-global64 and RSS remain NOT_QUALIFIED. All original physical gates, tolerances, shared280MiB cap and170/180s timing limits remain unchanged. Earlier failures and receipts are preserved.

Source-only authoring: small JSON/source/hash IO only; physics/import/test/compiler/codec execution0. The large archive was not read. `preserve-full-03.py` is a separate Root-only preservation action with a fixed64KiB hash buffer; authoring this document does not claim that script has run.
