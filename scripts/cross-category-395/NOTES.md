# #395 overlapping utilities on one element: BaroCSS winner vs Tailwind 4.3.3

Measurement only, no product code. Rerun (after `pnpm build:library`):

    PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> node scripts/cross-category-395/run.mjs
    node scripts/cross-category-395/freq.mjs

`result.json` holds `summary` + `rows` (run.mjs) and `frequency` (freq.mjs).

## Method

- 58 pairs `(a, b)` that set the same property at equal specificity (padding, margin, inset, size, radius,
  border width/color, flex, gap, overflow, place-*, grid span/start, typography, scroll, outline,
  display, same-property pairs). Categories come from `parseClassName(c).utility.category`, which the
  browser `StylePartitionManager` uses for its partitions.
- Every pair runs twice: first use on the page `a` then `b`, and `b` then `a`. The page has `#none`,
  `#a`, `#b` (in first-use order), then `#ab` (`class="a b"`) and `#ba` (`class="b a"`).
- The winner is whichever single-class element the combined element matches on the conflict properties.
  A sentinel `@layer base` style gives every property a non-default value, so `pb-0` / `block` / `w-auto`
  still count as setting something.
- Surfaces: Tailwind build (`compile().build()`), `ServerRuntime.generateCssForHtml(page)`, kit
  `generateCss(classes in first-use order)` with `themeToCssVars()`, and the browser runtime (document
  mode, default partitions, elements appended one at a time after `observe()`). All run in Chromium 1223.
- 50 of the 58 pairs had a clear Tailwind winner. Excluded: `mx-auto+ml-0`, `size-4+h-8`,
  `size-full+w-auto` (no measurable conflict with the sentinel), and `text-lg+leading-none` (mixed in
  Tailwind too).

## Results (mismatches vs Tailwind, over 50 comparable pairs)

| surface | a used first | b used first |
|---|---|---|
| runtime | 8/50 | 44/50 |
| server  | 4/50 | 44/50 |
| kit     | 4/50 | 44/50 |

- Class order on the element never matters: `#ab` and `#ba` always resolve the same way. What decides is
  the order of first use on the page.
- On every surface the class used later on the page wins. That holds inside a category as well, since
  the categories are coarse (`spacing` covers both `p-4` and `px-2`) and the rule sort key (#254) only
  orders at-rules. Tailwind instead orders by its property order: shorthands before sides/longhands,
  then by candidate for same-property pairs.
- When the broad utility is used first, server and kit match Tailwind except for 4 same-property pairs.
  In those, Tailwind's candidate order is not first-use order: `bg-red-500` beats `bg-blue-500`,
  `text-left` beats `text-center`, `text-sm` beats `text-lg`, `shadow-sm` beats `shadow-none`.
- **Runtime-only defect (worst case):** side-border utilities (`border-t-4`, `border-x-0`, `border-l-4`,
  `border-t-0`, `border-t-blue-500`, `border-y`, `border-s-2`) get no category from `parseClassName`.
  In the runtime, broad `border` / `border-2` / `border-red-500` wins over them in **both** first-use
  orders (7 of the 8 border cases). Tailwind lets the side utility win. So the common idiom
  `border border-l-4` or `border border-t-0` renders wrong in the browser runtime no matter the order.
  Server and kit only get this wrong when the side class is used first.

## Frequency in recorded AI output

130 pages (cms-probe blocks/theme-blocks, o5-probe, json-render-376 outputs, mcp-model-outputs,
mcp-html-probe, email-probe, playcdn-probe, E-006/E-007/E-011 runs), 4,957 elements with classes.
freq.mjs counts two same-variant classes as a real overlap when Tailwind declares the same physical
longhand for both, with different values, on the element itself. It excludes composition through
`var(--tw-*)` (such as `text-sm + leading-6` or `transition + duration-300`) and child or pseudo
selectors (`space-y-*`, `placeholder-*`).

- 11 elements carry an overlapping pair (0.22%): `m-0+mt-1`, `m-0+mb-*`, `pb-4+py-2`,
  `outline+outline-2`, `border+border-2`, `border+border-l-4`.
- Only 1 would resolve differently from Tailwind under first-use order (0.02%): `border` + `border-l-4`
  in a haiku callout block. That is exactly the runtime defect above, so the runtime gets it wrong
  whatever the order.
- AI output mostly writes the broad class first (`m-0 mt-1`, `border border-l-4`), which is also
  Tailwind's order. So first-use order usually agrees with Tailwind.

## Recommendation: FIX (small), plus document the rest

1. **Runtime (the defect):** give side-border utilities (`border-{t,r,b,l,x,y,s,e}[-*]`, width and color)
   the `borders` category, so they share a partition with `border` and follow its sort. Add a unit
   test: `border border-l-4` and `border-l-4 border` in both use orders resolve to `border-l-4`.
2. **Optional, all surfaces:** add a Tailwind property-order component to `ruleSortKey`: the index of
   the first declared property in Tailwind's property-order list, then a tiebreak by more declarations
   first. The server already sorts globally by that key, and the runtime's in-partition `insertSorted`
   uses it too. Kit `generateCss` would sort its output the same way. That removes the first-use
   dependency for same-category pairs (padding, margin, inset, radius ...). Cross-category pairs
   (`flex-1` in `layout` vs `grow` in `flex-grid`) would still follow partition first-use order unless
   partitions get a fixed rank. Given 0.02% real frequency, document that residue instead of adding
   partition ranking.

Without step 2: document that on every BaroCSS surface, when two utilities set the same property,
the one used later on the page wins. Tailwind's own ordering does not apply.
