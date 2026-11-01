# Independent audit, round 3 (targeted): suppressed features in lookKeysOf

**PASS. Verdict: ACCEPT.**

## Probes (probe4.test.ts, output in probe4.out)
- **K2:** a revision adds a suppressed `union(n3, n1)`. Evaluation gives b1 and b3, and `lookKeysOf` gives {b1, b3}. Nothing is held.
- **K2i (the inverse):** a suppressed solid feature (extrude n3) is not counted as a body. `lookKeysOf` gives {b1}, and the override on b3 is held, both when the revision is offered and after accept.
- **K2s:** a suppressed split makes the part one b1 body again. b1_negative is held and b1 is not.
- **K1:** over the 96 part documents in the corpus, `lookKeysOf` equals the evaluated keys. 0 misses, 0 extras.

## Mutant (in a scratch copy: mut/, mutate.sh, mutant-suppressed-ignored.diff and .out)
- `const live = doc.nodes` (suppression ignored again) is killed by the test "a suppressed feature neither hides the bodies it would have consumed nor counts as a body itself".
- The unmutated baseline passes 25/25.

## Follow-up only (low; a false "held" note, no data lost)
- **Case K2c:** a suppressed feature is built on b1, and a later live feature also consumes b1 (a branching history).
- **What evaluation does:** it passes the suppressed split through as a body (b4, which is look key b1, 2000 mm³) beside the union (b3). `lookKeysOf` gives only {b3}, so b1 is reported as held.
- **Why it is follow-up only:** the live, unsuppressed version of this history already duplicates the body in evaluation, so this is an unusual history shape. A full fix would model a suppressed non-root feature as passing its parent through.
- Script: k2c.ts.
