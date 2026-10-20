# R12.4 bend data from public pages (read 2026-10-20)

This note supports D120. A read-only research pass collected these on the owner's pre-approved terms (relayed by the coordinator):
- public HTML only: no sign-in, nothing downloaded, essential cookies only, no PDF opened;
- values only, each with its URL, the date read and the page's own label;
- no tables or prose copied.

**The values are not bundled in the studio.** Both sources' reuse terms are unclear, and the standing data rules say no unclear-licence datasets. The owner decides (D120, a pending decision).

## Source A: SendCutSend, "Sheet Metal Bending Calculator"
- **Page:** https://sendcutsend.com/bending-calculator/ (read 2026-10-20). The bending-specifications table's columns include "K Factor", "Bend Deduction @ 90°" and "Effective Bend Radius @ 90°".
- **Method:** their FAQ (https://sendcutsend.com/faq/what-are-your-material-bending-specifications/) says they air bend. Radius and K are fixed per material and thickness, and the radius is the expected inside radius after a 90° bend.
- **Terms:** © Send Cut Send, Inc.; no licence for reuse found (not checked further). **Not cleared.**
- **Units:** the page is in inches; the mm figures are conversions.

| Material | T | Effective R | Angle | K | BD |
|---|---|---|---|---|---|
| 5052 aluminium | 0.063 in (1.60 mm) | 0.035 in (0.89 mm) | 90° | 0.42 | 0.096 in |
| 5052 aluminium | 0.125 in (3.18 mm) | 0.125 in (3.18 mm) | 90° | 0.44 | 0.216 in |
| Mild steel | 0.048 in (1.22 mm) | 0.045 in (1.14 mm) | 90° | 0.38 | 0.0860 in |
| Mild steel | 0.059 in (1.50 mm) | 0.063 in (1.60 mm) | 90° | 0.40 | 0.1080 in |
| Mild steel | 0.187 in (4.75 mm) | 0.125 in (3.18 mm) | 90° | 0.36 | 0.3225 in |
| 304 stainless | 0.048 in (1.22 mm) | 0.080 in (2.03 mm) | 90° | 0.36 | 0.1045 in |
| 304 stainless | 0.060 in (1.52 mm) | 0.070 in (1.78 mm) | 90° | 0.34 | 0.1185 in |

**Our check:** BD = 2(R + T) − (π/2)(R + K·T), computed from the page's own K and R.
- It agrees with the page's BD within about 0.002 in for mild steel 0.059, 304 at 0.060 and 5052 at 0.125.
- For 5052 at 0.063 the formula gives about 0.0995 in against the page's 0.096. The page's K and BD there are not consistent with each other to 3 %: a bend table should take one of them, not both.

## Source B: vedge.org, "K-Factors for Sheet Metal"
- **Page:** https://vedge.org/kfac.html (read 2026-10-20).
- **Provenance:** a personal site citing "Machinery's Handbook, 26th Edition", so it is a secondary copy of a copyrighted handbook.
- **Unknowns:** no licence; no angle; alloy and grade not stated.
- **Use:** **not used**, beyond noting that it disagrees with A, as expected between handbook and air-bending values. Examples:
  - aluminium 0.063 in: K 0.404 at R 0.030 in;
  - cold-rolled steel 0.060 in: K 0.463 at R 0.060 in.

## Radii and ranges (no per-thickness K)
- **Fictiv sheet-metal specifications** (https://blog.fictiv.com/specifications/sheet-metal):
  - minimum bend radius in multiples of t: 5052 0.5–1.0t, cold-rolled steel 0.5–1.0t, 304 1.0–2.0t;
  - K ranges by class: aluminium 0.33–0.40, steel 0.40–0.45, stainless 0.45–0.50.
- **Protolabs bend-radius guidelines** (https://www.protolabs.com/resources/design-tips/the-basics-of-bend-radii-in-sheet-metal/): default inside radius 0.030 in; illustrative K 0.33 for air bending, 0.42 for bottoming. The page says these are not their own measured values.

## Excluded or not opened
- HUNSONE's chart: labelled "Sample", with implausible values and no source.
- OSH Cut: no per-thickness values in the page's text.
- No per-thickness K was found on Xometry, Ponoko, Geomiq or Approved Sheet Metal.
- PDF candidates, not opened: Protocase's bend radii PDF; a SendCutSend upload.

## What the studio does instead
- A sheet takes one K (the prefill 0.5, flagged as an estimate) or **the user's own bend table**: a JSON file loaded from the body's panel, checked by the kernel. Each row cites a source or says it is an estimate.
- Bundling source A's 90° rows as a built-in table would be quick if the owner clears it. Each row would cite its URL, date and label, with the 5052 0.063 K/BD inconsistency noted and only one of the two values taken.
