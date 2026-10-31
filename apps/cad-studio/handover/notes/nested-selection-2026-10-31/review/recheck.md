# Re-check of the ②c findings

Verdict: **ACCEPT**

1. **Selection array identity: PASS.** With no nested entry, `viewportInstanceSelection` returns the input array itself, for both a plain selection and an empty one (probe2r). The App memo deps are `[instanceSel, instanceBodies]`.
2. **Render panel: PASS.** `renderKeysOf` returns:
   - `['p1/p2']` → no keys, mode `disabled`
   - `['p1', 'p1/p2']` → key `inst:p1` only
   - `[]` → mode `default`

   `setLook` returns early, the Look fieldset is disabled, and the hint is shown. "Use the default appearance" stays hidden because there are no keys.
3. **Body mapping and refusals: PASS.** Face names are now read through the evaluated entry. A host document that refuses to fold gives:
   - viewport selection `[]`, with no throw
   - card `unavailable` and volume null

   Residual, a follow-up only: the card's title and placement come from the current `doc`, but the volume comes from the evaluated bodies. Probe2r's swap shows "Sub › A" with the old 2356 mm³ volume. This happens only between an edit and its re-evaluation, or while a variant is showing.
4. **Unknown volume and closure: PASS.** Unattributed bodies give a null volume, shown as "…". `walkRows` is at module level.

## What I ran

- probe1 (adapted) and probe2r: all of the model's origin results are unchanged.
- Under the gate:
  - cad-studio `nested-selection`, `instance` and `render` tests: 25/25 pass
  - `tsc` clean
  - cad-model `body-origin`: 4/4 pass
