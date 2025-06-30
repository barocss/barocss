# 📝 cssma-v3 Parser & Test Implementation Guide

This guide summarizes best practices and checklists for implementing and testing utility parsers in cssma-v3, based on the context-driven color parser refactor. Use this as a reference for all future parser and test development.

---

## 0. ⚠️ Number Parsing & Theme Lookup: Critical Note

**Always use string keys for numeric theme lookups!**

- When looking up values in `theme.spacing`, `theme.fontSize`, etc., always use string keys (e.g., `'4'`, `'2'`, `'6'`), not numbers (4, 2, 6).
- This applies to both parser code and test mocks:
  - `theme.spacing['4']` is valid, but `theme.spacing[4]` is not (unless the theme object redundantly defines both).
  - When writing mock theme objects for tests, always use string keys for all numeric values.
- If you use a number as a key, lookups will fail and return `undefined`, causing subtle bugs.
- **Troubleshooting tip:** If a context-based parser returns `null` for a valid preset, check that your theme object uses string keys for all numbers.
- **Spacing utilities (margin, padding, etc.) must always return the full theme path in the `preset` field (e.g., `spacing.px`, not just `px`).**
- **All return objects (spacing, color, etc.) must use a unified structure: `{ type, value, raw, arbitrary, customProperty, preset? }`.**
- **Test expectations must always match the actual parser output structure, including all fields.**

---

## 1. Parser Implementation Checklist

### 1) Context-based preset lookup (with parseContextColorUtility or parseContextSpacingUtility)
- Use `parseContextColorUtility` for color utilities and `parseContextSpacingUtility` (or equivalent) for spacing utilities (e.g. margin, padding).
- Pass `{ token, prefix, type, context, allowOpacity }` to the utility:
  - `token`: the full utility class (e.g. 'bg-blue-200/50', 'm-4')
  - `prefix`: the utility prefix (e.g. 'bg', 'm', 'p', ...)
  - `type`: the return type string (e.g. 'background-color', 'margin')
  - `context`: CssmaContext with theme getter
  - `allowOpacity`: set to `true` if `/opacity` is supported (for color)
- **Only treat the result as valid if the returned value is not null.**
- **Spacing utilities must always return the full theme path in the `preset` field (e.g., `spacing.4`, `spacing.px`).**
- Example usage:
  ```ts
  const result = parseContextSpacingUtility({ token, prefix: 'm', type: 'margin', context });
  if (result) return result;
  ```
- If not using context utility, fallback to custom property/arbitrary value logic as needed.

### 2) Custom property parsing (with parseCustomPropertyUtility)
- Use `parseCustomPropertyUtility` for custom property parsing.
- Pass `{ token, prefix, type }` as parameters.
- **Custom property + opacity (e.g., `bg-(--my-color)/50`) is not supported.**
- **Return object for custom property must always include `arbitrary: false` (for spacing), `customProperty: true`, and all other standard fields.**
- Example:
  ```ts
  parseCustomPropertyUtility({ token: 'm-(--my-margin)', prefix: 'm', type: 'margin' });
  // → { type: 'margin', value: 'var(--my-margin)', raw: 'm-(--my-margin)', arbitrary: false, customProperty: true }
  ```

### 3) Arbitrary value support
- Support patterns like `text-[#50d71e]`, `m-[5px]` using `extractArbitraryValue` and appropriate value checkers.
- Mark returned objects with `arbitrary: true`, `customProperty: false`.
- **Return object structure must be consistent across all utilities.**

### 4) Unified return object structure
- Always return objects with `{ type, value, raw, arbitrary, customProperty, preset? }`.
- `value`: the logical value extracted from the token (not the resolved value).
- `preset`: the context lookup path, if relevant (e.g., `spacing.4`, `colors.red.500`).
- **Tests must expect all fields as returned by the parser, not a simplified or legacy structure.**

### 5) ⚠️ Spacing/Number-based Preset Parsing
- When parsing spacing, fontSize, or any numeric preset, always convert the matched number to a string before theme lookup:
  - Example: `theme.spacing[String(val)]` or `theme.spacing[val]` where `val` is already a string from regex.
- When writing mock theme objects for tests, always use string keys for all numeric values (e.g., `'4': 16`, not `4: 16`).
- If you get `undefined` from the theme, check your key type!
- **Spacing utilities must always return the full theme path in the `preset` field.**

---

## 1.5. Troubleshooting & Debugging Checklist (NEW)

- **Regex Issues:**
  - Double-check regex patterns for typos (e.g., `[w-]+` should be `[\w-]+`).
  - If all preset parsing fails, check for regex errors first.
- **Theme Key Type:**
  - If a valid preset returns `null`, ensure theme keys are strings, not numbers.
- **Test Expectation Mismatch:**
  - If tests fail but parser output is correct, update test expectations to match the parser's actual return structure (including all fields like `preset`, `customProperty`, etc.).
- **Return Structure Consistency:**
  - All spacing and color utilities must return objects with the same field structure for preset, custom property, and arbitrary value cases.
- **Debug Logging:**
  - Use detailed logs in parser/test debugging to trace field mismatches and lookup failures.

---

## 2. Parser Implementation Example (color & spacing)

### Using parseContextColorUtility (color)
```ts
import { parseContextColorUtility } from '../utils/colorParser';

export function parseBackgroundColor(token: string, context?: CssmaContext): any | null {
  // 1. context-based palette lookup (with opacity)
  const result = parseContextColorUtility({ token, prefix: 'bg', type: 'background-color', context, allowOpacity: true });
  if (result) return result;

  // 2. custom property, arbitrary value ...
}
```

### Using parseContextSpacingUtility (spacing)
```ts
import { parseContextSpacingUtility } from '../utils/spacingParser';

export function parseMargin(token: string, context?: CssmaContext): any | null {
  // 1. context-based spacing lookup
  const result = parseContextSpacingUtility({ token, prefix: 'm', type: 'margin', context });
  if (result) return result;

  // 2. custom property, arbitrary value ...
}
```

---

## 3. Test Implementation Checklist

### 1) Test with both mock context and defaultConfig context
- **Mock context**: minimal palette for fast, focused unit tests.
- **defaultConfig context**: real palette for integration/compatibility tests.
- **Always use string keys for numeric theme values in mocks!**
- **Test expectations must match the parser's actual return structure, including all fields.**

### 2) Always check that `value` is the logical token value
- Never expect the resolved value in `value` (e.g., for spacing, expect '4', not '16' or '1rem').

### 3) Always test invalid/null cases
- Palette object (not a string) should return null.
- Nonexistent color/shade or spacing key should return null.
- Invalid arbitrary values should return null.

### 4) Custom property and arbitrary value structure
- For custom property: `{ type, value, raw, arbitrary: false, customProperty: true }` (spacing), `{ ...arbitrary: true, customProperty: true }` (color)
- For arbitrary value: `{ type, value, raw, arbitrary: true, customProperty: false }`
- For preset: `{ type, value, raw, arbitrary: false, customProperty: false, preset: 'theme.path' }`
- **Tests must expect all fields as returned by the parser.**

---

## 4. Test Example

```ts
expect(parseTextColor("text-red-500", context)).toEqual({
  type: "color",
  value: "red-500",
  raw: "text-red-500",
  arbitrary: false,
  customProperty: false,
  preset: "colors.red.500"
});
expect(parseTextColor("text-red", context)).toBeNull(); // palette object is invalid
expect(parseTextColor("text-[#50d71e]", context)).toEqual({
  type: "color",
  value: "#50d71e",
  raw: "text-[#50d71e]",
  arbitrary: true,
  customProperty: false
});

expect(parseMargin("m-4", context)).toEqual({
  type: "margin",
  value: "16",
  raw: "m-4",
  arbitrary: false,
  customProperty: false,
  preset: "spacing.4"
});
expect(parseMargin("m-(--my-margin)", context)).toEqual({
  type: "margin",
  value: "var(--my-margin)",
  raw: "m-(--my-margin)",
  arbitrary: false,
  customProperty: true
});
expect(parseMargin("m-[5px]", context)).toEqual({
  type: "margin",
  value: "5px",
  raw: "m-[5px]",
  arbitrary: true,
  customProperty: false
});
```

---

## 5. Practical Tips

- Apply the same pattern to all context-based utilities (spacing, color, etc.).
- Only the context.theme path changes; the rest of the structure and tests are nearly identical.
- Use utils (extractArbitraryValue, isColorValue, etc.) for consistency.
- **Always use string keys for numeric theme values in all test mocks and real themes.**
- **Always expect the full theme path in the `preset` field for all preset-based utilities.**
- **Test expectations must always match the parser's actual output, including all fields.**

---

## 5.5. Shared Utility Functions Reference

### General Parser Utils (`utils.ts`)
- **extractArbitraryValue(token, prefix):** Extracts the value inside `[brackets]` for a given prefix (e.g. `m-[10px]` → `10px`). Used for arbitrary value parsing in all utility parsers.
- **isLengthValue(val):** Checks if a string is a valid CSS length (e.g. `2vw`, `1.5rem`, `10px`, `100%`). Use to validate arbitrary values for spacing utilities.
- **isColorValue(val):** Checks if a string is a valid CSS color (hex, rgb, hsl, oklch, okhsl). Use to validate arbitrary values for color utilities.
- **isNumberValue(val):** Checks if a string is a pure number (integer or float).
- **isVarFunction(val):** Checks if a string is a valid CSS `var()` function (e.g. `var(--foo)`). Use to allow custom property values as arbitrary values.
- **isSelectorModifier(mod):** Type guard for selector-like modifiers (pseudo, group, peer, state, etc.).
- **isResponsiveModifier(mod):** Type guard for responsive/breakpoint/container modifiers.
- **isMediaModifier(mod):** Type guard for media/darkmode/motion modifiers.
- **isArbitraryModifier(mod):** Type guard for arbitrary/attribute modifiers.
- **getModifierPriority(mod):** Returns the sort priority for Tailwind-style modifiers (used for selector sorting).
- **sortModifiersForSelector(modifiers):** Sorts an array of modifiers by Tailwind priority.

### Color Parser Utils (`colorParser.ts`)
- **parseContextColorUtility({ token, prefix, type, context, allowOpacity }):**
  - Context-based color preset parser (e.g. `bg-blue-200`, `border-red-500/75`).
  - Returns a standardized object with `type`, `value`, `raw`, `arbitrary`, `customProperty`, `preset`, and optional `opacity`.
  - Used as the first step in all color utility parsers.

### Spacing Parser Utils (`spacingParser.ts`)
- **parseContextSpacingUtility({ token, prefix, type, context }):**
  - Context-based spacing preset parser (e.g. `m-4`, `px-2`).
  - Returns a standardized object with `type`, `value`, `direction`, `raw`, `arbitrary`, `negative`, `preset`.
  - Used as the first step in all spacing utility parsers (margin, padding, etc.).

### Custom Property Parser Utils (`customPropertyParser.ts`)
- **parseCustomPropertyUtility({ token, prefix, type }):**
  - Parses custom property utility syntax (e.g. `bg-(--my-color)`, `m-(--my-margin)`).
  - Returns a standardized object with `type`, `value`, `raw`, `arbitrary`, `customProperty`, and optional `opacity`.
  - Used as the fallback for custom property parsing in all utility parsers.

---

## 6. Documentation/Sharing

- Save this guide as `/docs/parser-guide.md`.
- Reference it for all new parser/test development to ensure consistency and maintainability.
- Update this guide whenever a new pattern or lesson is learned from debugging or refactoring.

---

## 7. Advanced Best Practices & Clarifications (2024-06 backgroundColor & spacing refactor)

### 1) Opacity Support (e.g., bg-blue-200/50) with parseContextColorUtility
- If a color utility supports `/opacity` (e.g., `bg-blue-200/50`), set `allowOpacity: true` in the call to `parseContextColorUtility`.
- Example:
  ```ts
  const result = parseContextColorUtility({ token, prefix: 'bg', type: 'background-color', context, allowOpacity: true });
  if (result) return result;
  ```
- The returned object will include an `opacity` field if present in the token.
- `value` should always be the logical color value (e.g., `blue-200`), and `opacity` should be an integer (0~100).
- Example:
  ```ts
  expect(parseBackgroundColor('bg-blue-200/50', context)).toEqual({
    type: 'background-color',
    value: 'blue-200',
    raw: 'bg-blue-200/50',
    arbitrary: false,
    customProperty: false,
    preset: 'colors.blue.200',
    opacity: 50
  });
  ```

### 2) customProperty, arbitrary, preset Field Structure
- **Custom property** (e.g., `bg-(--my-bg)`, `m-(--my-margin)`):
  - For color: `{ arbitrary: true, customProperty: true }`
  - For spacing: `{ arbitrary: false, customProperty: true }`
- **Arbitrary value** (e.g., `bg-[#50d71e]`, `m-[5px]`): `{ arbitrary: true, customProperty: false }`
- **Preset (palette/theme)**: `{ arbitrary: false, customProperty: false, preset: 'colors.xxx.xxx' }` or `{ ...preset: 'spacing.4' }`
- All returned objects must follow this structure for consistency.
- **Tests must expect the exact structure as returned by the parser.**

### 3) Context-based Invalid Handling
- If context-based utility returns `null`, treat as invalid (e.g., palette object, undefined, or null from context.theme).
- If called without a context, also return `null`.
- Example:
  ```ts
  expect(parseBackgroundColor('bg-red', context)).toBeNull(); // palette object is invalid
  expect(parseBackgroundColor('bg-foo', context)).toBeNull(); // not in palette
  expect(parseMargin('m-foo', context)).toBeNull(); // not in spacing
  ```

### 4) Explicit Context in Tests
- All tests must explicitly pass a context (either mock or defaultConfig).
- Always test both mock context (minimal palette) and defaultConfig context (real palette) for robust coverage.
- Example:
  ```ts
  expect(parseBackgroundColor('bg-red-500', mockContext)).toEqual({
    type: 'background-color',
    value: 'red-500',
    raw: 'bg-red-500',
    arbitrary: false,
    customProperty: false,
    preset: 'colors.red.500'
  });
  expect(parseBackgroundColor('bg-red-500', defaultCtx)).toEqual({
    type: 'background-color',
    value: 'red-500',
    raw: 'bg-red-500',
    arbitrary: false,
    customProperty: false,
    preset: 'colors.red.500'
  });
  expect(parseMargin('m-4', mockContext)).toEqual({
    type: 'margin',
    value: '16',
    raw: 'm-4',
    arbitrary: false,
    customProperty: false,
    preset: 'spacing.4'
  });
  expect(parseMargin('m-4', defaultCtx)).toEqual({
    type: 'margin',
    value: '1rem',
    raw: 'm-4',
    arbitrary: false,
    customProperty: false,
    preset: 'spacing.4'
  });
  ```

### 5) custom property 파싱 시 opacity 분리 문법은 허용하지 않음(테스트/문서에서도 기대하지 말 것)
- context 기반 팔레트/spacing 파싱과 custom property/arbitrary value 파싱은 각각 전용 유틸리티를 사용하여 일관성 유지
- **Spacing, color 등 모든 유틸리티에서 return object 구조와 필드 일치성 유지**

By following these advanced practices, all cssma-v3 parsers and tests will remain robust, extensible, and consistent as the codebase evolves.

**By following this guide, all cssma-v3 parsers and tests will be robust, extensible, and consistent!** 