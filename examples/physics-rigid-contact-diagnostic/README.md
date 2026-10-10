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
