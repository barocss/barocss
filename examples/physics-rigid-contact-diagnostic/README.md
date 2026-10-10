# Private eight-box solver phase diagnostic

Issue #1188. Base `d2ad0f050c302e1d8082aedc48474064b625353b` contains the exact
adopted #1185 NO-GO reference. Producer measured source:
`866f7edf2b4038521f3f8a8fe80937c99f6b8f05`.

## Boundaries

The private world adds copied inspection records. Contact detection, manifold
selection, response, pass count, materials, input order and accepted state are
unchanged. This is not a public API or a qualified physical model. Frozen source
hash and hooks are recorded in #1188 comment 6094968071 and world-transform.json.

There are 126 intermediate frames per fixture: free integration and eight pass
ends for each of six steps, plus before/after all 36 pairs at step6/pass7. An
intermediate state's timestamp denotes the upcoming accepted step. Its empty
contact/event arrays are placeholders, not evidence of missing contacts. Hit
metadata records that pair's actual subsequent detector/manifold choice.

All nine producer trials pass original accepted public state and raw Float64
parity against the retained #1185 output, including its first failing step6.
Phase traces also match across source, unchanged repeat and compiled-dependency
graphs. The private instrumented world stays source in both graph modes. The
recorder accepts no caller callback, freezes owned copies and returns copies.

## Reproduce

Use Node22 and real installed workspace dependencies. The adopted admission
reference build helper creates its documented ignored CAD type-dependency lease
using real emitted declarations and preserves the source runtime import.

```sh
REPO_DEPS_ROOT=/path/to/installed/checkout node examples/physics-rigid-engine-reference/build-local.mjs
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck examples/physics-rigid-contact-diagnostic/instrumented-world.ts examples/physics-rigid-contact-diagnostic/trace.ts
node examples/physics-rigid-contact-diagnostic/run.mjs /tmp/physics-1188-rerun
python3 examples/physics-rigid-contact-diagnostic/phase-analysis.py /tmp/physics-1188-rerun
```

The independent offline analyzer imports the original Decimal geometry observer,
not the producer. It decodes raw fields and compares all28cube+8floorpairs at
each checkpoint. It distinguishes increased existing penetration from a
reopened pair, and validates all counts/order/copies/endpoint and graph parity.
Diagnostic validity never changes the physical model's NO-GO. No refinement,
cost, browser, Viewer, public cap extension or publication follows from this
six-step diagnostic.


## Actual phase result

The independent analyzer passes all63accepted snapshots and1,134trace frames;
its13synthetic controls and the original65geometry controls pass. Counts/order,
all36pairs/frame, Decimal80/120 precision, pair continuity, accepted endpoints
and unchanged graph traces pass. This validates the diagnostic, not the model.

At step6/pass7, b0/b1 has a four-point manifold in every scene. Its correction
removes its own geometric overlap (YAW leaves only2.59e-17m, within the1e-10m
classification band). Then b0/floor correction reopens b0/b1; b1/b2 correction
increases that existing residual to the original failing final value:

| Scene | Before b0/b1 correction | After own correction | After floor correction | After b1/b2 correction |
| --- | --- | --- | --- | --- |
| ALIGNED | 2.202602784mm | 0mm | 1.101301392mm | 2.110962872mm |
| OFFSET | 2.336689209mm | 0mm | 1.168344604mm | 2.240780274mm |
| YAW | 2.342667207mm | within1e-10m | 1.171333603mm | 2.246556736mm |

In the36recorded pair decisions at this final pass, missed detection and
single-point fallback counts are zero in each scene. That is a bounded
observation, not complete manifold/detector validation. Eight events reopen neighboring
pairs and six events increase existing residuals in each recorded scene/pass.
Original outer passes reduce the worst overlap during step6 but still finish
above2mm. Later pair corrections causally reopen an already solved contact in
this exact trace. General schedule convergence, velocity settling, manifold
adequacy and ten-second physical quality remain unqualified.

The next question is one bounded additional global position relaxation stage
after the unchanged response, with its own frozen input/quality/cost contract.
No such physical-model change was implemented by this diagnostic.

Durable actual logs, raw fields, full copied reports, independent analysis,
control receipts and hashes are in evidence/native-866f7edf/.
