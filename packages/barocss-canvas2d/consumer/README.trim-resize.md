# Trim a resized bordered Sprite

Load the bordered image, choose 80 × 40, then Trim. The trimmed 3 × 2 image keeps the current scale and visible position: Sprite size becomes48 × 20 at36,30. The transparent border is removed without resetting the displayed geometry.

This placement rule applies to the existing complete5 × 4 Bordered input with zero anchor, unit transform scale, zero rotation, absent or zero pivot, and no slice or tile. Other recipes retain their existing calculation. Asset trimming and renderer admission use the existing public APIs.

The #1556 native flow qualifies this nearest-sampled, integer-aligned fixture only. It does not claim general filtering or transform parity. Existing disabled control and diagnostic callbacks remain until page closure; this change does not alter lifetime policy. Affected source build and scoped types passed. The actual Chrome source flow passed: all230400 frame bytes matched before and after Trim; the independent literal RGBA oracle had maximum error0. All three tracked GL resource populations retired. Existing callbacks remain qualified:22 additions,9 removals,13 callbacks until page closure. No Save, Open or PNG flow ran. Exact Integration adoption is pending. Original #1346 fixed-size proof stays immutable.
