# Harness explicit-data reservation

This table covers the harness process. Candidate allocation has its own frozen ALLOCATION.md tied to ROOT RUNTIME-LAYOUT-01.json. The independent checker has its own fixed budget. No process RSS claim follows.

| Owned data | Bound before allocation | Release/ownership |
|---|---|---|
| Request or reply file bytes | 2MiB each, stat checked before read | One current frame, then release |
| JSON decoding | Count syntax tokens before json.loads; reserve 256B/token + 8B/raw byte + 8MiB scratch; add all specified live frame/manifest/corpus data and require <=64MiB | Reserve before dense decode; check actual explicit graph after |
| JSON structure | At most 128 nested containers | Refuse before dense decode |
| Parent command stdout | 2MiB maximum, 64KiB read chunks | Captured bytes persisted once |
| Parent command stderr | 64KiB maximum | Captured bytes persisted once |
| Evidence | 16MiB per stage, with 64KiB terminal first-failure reserve | Exclusive files only; external child files adopted once |
| Stage A parent data | One request/reply, fixed ten-row manifest and six-row corpus | No retained reply history |
| Stage B parent data | One original request, full reply, saved V2 oracle, actual in-call kernel plus fixed manifests/summary | All heavy frame objects deleted before next frame |
| Child process | One active process at a time; output reservation before append; no parallel frame processes | On failure kill only this child process group and reap within bounded cleanup |

Token reservation is conservative for the pinned CPython runtime object layout. Count strings, scalar tokens and container starts; reserve 256 bytes per token for node, object and container-slot overhead, plus eight times raw bytes for decoded character/integer storage and transient copies. Existing immutable saved authority files still require complete byte/hash validation. Unknown, oversized or overly deep candidate payloads fail; do not reduce the physical payload to meet a bound.

Explicit retained traversal accounts shared references once and refuses above64MiB. Deadline checks use floor(remainingSeconds*1000); no positive timeout is synthesized after the deadline. Internal170s/external180s and candidate/checker original operation/bit limits remain separate.
