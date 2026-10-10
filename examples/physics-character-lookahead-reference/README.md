# Private same-ray lookahead movement candidate

Existing discovery830, pre-code freeze6092968568. Additive to native0d8c5804; first controller and failure are immutable. No public controller/package/kernel/root changes. All original8scene inputs and metrics/constants/query handling are reused. New controller/slide/controls/campaign modules keep responsibilities separate.

Only slide queries add0.02m inspection along the same original ray. Actual hitfraction/normal determines a normal-skin prefix, clamped to the original requested distance. A farther hit cannot trigger a premature step when the full original request remains safe. Inspection never teleports extra distance. Closing<=1e-12 refuses atomically. Original step/assist/snap behavior remains. This does not prove universal glancing skin.

Node22:

```sh
node examples/physics-character-lookahead-reference/setup.mjs
node examples/physics-character-lookahead-reference/run.mjs /tmp/physics-character-lookahead
node examples/physics-character-lookahead-reference/decode.mjs /tmp/physics-character-lookahead/manifest.json
```

Independent old decoder imports no candidate. First numerical failure stays visible; conditionalcost/browser only after all8scenes/controls/repeat/raw pass. Actual Viewer and publiccontroller remain later. Results are UNMEASURED until an actual run is recorded.
