# Barocss Variant System: Combination/Accumulation Rules Design

## 1. Essence of the Variant Chain
- Variant chain: multiple variants applied sequentially (e.g., `group-hover:not-hover:has-[.child]:*:`)
- Each variant defines only its own role (modifySelector, astHandler, wrap)
- Rather than per-combination functions, each variant adjusts selector with awareness of preceding/following variants

---

## 2. Core Rules (aiming for full v4 compatibility)

### (1) Selector accumulation/override
- Default: accumulate left → right (modifySelector)
- However, when preceded by group-hover/peer-hover, variants like **universal/not/has/arbitrary** return `{ selector, override: true }` and stop accumulation
  - e.g., `group-hover:*` → `&:is(:where(.group):hover > *)`
- When override is returned, the engine stops accumulation immediately

### (2) AST wrapping rules
- Single pseudo/universal/not/has/arbitrary: wrap as rule
- Compound combinations (2+ including group/peer/has/not): wrap as style-rule
- If at-rule exists, keep selector as-is and wrap AST only

### (3) Roles of each variant
- **group-hover/peer-hover**: transform selector to forms like `:is(:where(.group):hover *)`
  - If followed by universal/not/has/arbitrary, they complete selector via override
- **universal/not/has/arbitrary**: override when preceded by group-hover/peer-hover, otherwise accumulate
- **responsive/dark (at-rules)**: wrap AST with at-rule, keep selector as-is
- **compoundModifier**: use only for rare cases requiring special AST on co-occurrence

### (4) Handling '&' in selector
- Selector always starts with & (guaranteed by the engine)
- Preserve & prefix on override

---

## 3. Examples (aligned with v4)

| Variant Chain                      | Selector result (v4)               |
|------------------------------------|---------------------------------------------|
| `group-hover:*:bg-red-500`         | `&:is(:where(.group):hover > *)`            |
| `group-hover:not-hover:bg-red-500` | `&:is(:where(.group):hover *):not(:hover)`  |
| `peer-hover:has-[.child]:bg-red-500`| `&:is(:where(.peer):hover ~ *):has(.child)` |
| `sm:group-hover:*:bg-red-500`      | `@media (min-width: 640px) { &:is(:where(.group):hover > *) { ... } }` |
| `not-hover:focus:bg-red-500`       | `&:not(:hover):focus`                       |
| `*:[data-avatar]:rounded-full`     | `:is(.\*\:[data-avatar]\:rounded-full > *)[data-avatar]` |

---

## 4. Simulation: selector accumulation/override behavior

### (A) group-hover:*:bg-red-500
1. base: `&`
2. group-hover: `&:is(:where(.group):hover *)`
3. *: override → `&:is(:where(.group):hover > *)` (stop accumulation)

### (B) group-hover:not-hover:bg-red-500
1. base: `&`
2. group-hover: `&:is(:where(.group):hover *)`
3. not-hover: override → `&:is(:where(.group):hover *):not(:hover)`

### (C) peer-hover:has-[.child]:bg-red-500
1. base: `&`
2. peer-hover: `&:is(:where(.peer):hover ~ *)`
3. has-[.child]: override → `&:is(:where(.peer):hover ~ *):has(.child)`

### (D) sm:group-hover:*:bg-red-500
1. base: `&`
2. sm: at-rule wrapping (wrap AST only)
3. group-hover: `&:is(:where(.group):hover *)`
4. *: override → `&:is(:where(.group):hover > *)`

### (E) not-hover:focus:bg-red-500
1. base: `&`
2. not-hover: `&:not(:hover)`
3. focus: `&:not(:hover):focus`

---

## 5. Implementation Strategy
- Each variant adjusts selector considering previous/next variants
- universal/not/has/arbitrary override when preceded by group-hover/peer-hover
- engine stops accumulation when override is returned
- Use compoundModifier only for exceptional cases

---

## 6. Extensibility/Maintainability
- When adding new variants, follow these rules instead of per-combination functions
- Can cover all v4 selector combinations
- Adjust rules if selector/AST structure changes; the system stays consistent