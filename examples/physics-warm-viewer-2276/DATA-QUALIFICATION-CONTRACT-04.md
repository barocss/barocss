# Browser proof data qualification 04

Status: AUTHORED_NOT_EXECUTED. This is a data transport amendment. It does not change the server, browser, World, physical observer, arithmetic or gates.

The original desktop02 capture is immutable. The actual physics-audit02 process failed before any physical observer: the old decoder exceeded its 1,000,000 canonical fragment work bound at the full root fingerprint. The 16MiB expanded byte bound was not exceeded. DATA-FAILURE-03.json preserves the actual stderr and guard receipt. This is a data resource NO_GO, not a physical failure. The successful desktop checks do not establish physical qualification.

The separate transport_decode_04.py contract defines the new bounded implementation. The limits remain 16MiB expanded bytes, 8,192 shared nodes, depth 64 and 1,000,000 actual canonical fragments. The whole expanded root SHA256 and byte count, each referenced subnode hash, all-pool reachability and cycle checks remain mandatory. Only authenticated small node spans may be reused. Cached spans are operation local. No persistent trust survives a decoded-tree mutation or another decode call.

Before any browser physics observer is called, qualify-transport-04.py must pass on the exact frozen desktop02 proof. It imports only the old and new independent transport decoders. It compares a fixed canonical bank (quote, backslash, control escapes, non-ASCII and astral text, sorted keys, null, booleans, integers, finite floats and negative zero), exact 4,095/4,096/4,097-byte referenced-node cache boundaries, and all decoded words on three qualified Native packets, independently verifies the complete expanded browser root with a byte-bounded streaming stdlib oracle, reports its lexical chunk count only as an independent diagnostic (not an old fragment-protocol PASS), and refuses wrong root hash, root byte count, subnode payload, cycles, missing references and unreferenced nodes. It checks mutation isolation and unchanged byte/node/depth/actual-fragment caps. The old full-browser decoder failure is authenticated from saved evidence and is not rerun. The harness creates no World and calls no geometry, physics observer, browser or provider module.

AUDIT-PINS-04.json is an audit-only pin bank. It includes the unchanged SOURCE-PINS-03.json and its complete file bank, the proof and capture, prior failure receipts, qualification code, decoder code and contract, and new audit adapters. It does not replace the server selector. The adapters continue to verify every original SOURCE-PINS-03 file, then the separate04 bank. They require an actual PASS qualification receipt naming the same proof hash and same auditfreeze hash before decoding. Every original physical assertion, tolerance and browser/Node comparison remains unchanged.

Root runs these commands in order with the existing command guard. Stop on the first failure. Use fresh output locations, with no browser or World rerun:

```sh
python3 -B examples/physics-warm-viewer-2276/qualify-transport-04.py examples/physics-warm-viewer-2276/evidence/transport-qualification-04
python3 -B examples/physics-warm-viewer-2276/audit-browser-04.py examples/physics-warm-viewer-2276/evidence/browser-desktop-02/proof.json examples/physics-warm-viewer-2276/evidence/browser-desktop-02/physics-audit-04
python3 -B examples/physics-warm-viewer-2276/browser-node-parity-04.py examples/physics-warm-viewer-2276/evidence/browser-desktop-02/proof.json examples/physics-warm-native-2276/evidence/native-01 examples/physics-warm-viewer-2276/evidence/browser-desktop-02/browser-node-parity-04.json
```

The combined browser proof/audit/parity output bound remains 16MiB. Qualification output is separately bounded to 1MiB. Hidden accepted public outputs remain unretained and their raw equality remains NOT_PROVEN. Production and full P4 status are unchanged. This contract and all author scripts must be frozen and reviewed before execution.
