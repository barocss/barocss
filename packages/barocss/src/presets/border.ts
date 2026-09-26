import { staticUtility, functionalUtility, registerUtility, themeKeyVar, themeKeyValue } from "../core/registry";
import { atRoot, atRule, decl, property, rule } from "../core/ast";
import { parseNumber, parseLength, parseColor, themeColorDecls } from "../core/utils";

// --- Border Radius ---
//  border-radius documentation

// Static border radius utilities
staticUtility("rounded-none", [["border-radius", "0px"]], { category: 'borders' });
staticUtility("rounded-sm", [["border-radius", "var(--radius-sm)"]], { category: 'borders' });
staticUtility("rounded", [["border-radius", "0.25rem"]], { category: 'borders' });
staticUtility("rounded-md", [["border-radius", "var(--radius-md)"]], { category: 'borders' });
staticUtility("rounded-lg", [["border-radius", "var(--radius-lg)"]], { category: 'borders' });
staticUtility("rounded-xl", [["border-radius", "var(--radius-xl)"]], { category: 'borders' });
staticUtility("rounded-2xl", [["border-radius", "var(--radius-2xl)"]], { category: 'borders' });
staticUtility("rounded-3xl", [["border-radius", "var(--radius-3xl)"]], { category: 'borders' });
staticUtility("rounded-4xl", [["border-radius", "var(--radius-4xl)"]], { category: 'borders' });
staticUtility("rounded-xs", [["border-radius", "var(--radius-xs)"]], { category: 'borders' });
// #300: a theme.borderRadius.full other than the default wins over the literal, like Tailwind 4.3.3 where
// `@theme { --radius-full: ... }` makes rounded-full (and rounded-t-full ...) read var(--radius-full).
// #336: Tailwind 4.3.3 emits `calc(infinity * 1px)` for rounded-full (was 9999px).
const FULL = "calc(infinity * 1px)";
function roundedFull(name: string, props: string[]) {
  registerUtility({
    name,
    match: (className: string) => className === name,
    handler: (_value, ctx) => {
      const own = themeKeyValue(ctx, "borderRadius", "full");
      const value = own != null && own !== "9999px" && own !== FULL ? "var(--radius-full)" : FULL;
      return props.map((prop) => decl(prop, value));
    },
    category: "borders",
  });
}
roundedFull("rounded-full", ["border-radius"]);


// Individual corner radius utilities
[
  ["rounded-t", ["border-top-left-radius", "border-top-right-radius"]],
  ["rounded-r", ["border-top-right-radius", "border-bottom-right-radius"]],
  ["rounded-b", ["border-bottom-right-radius", "border-bottom-left-radius"]],
  ["rounded-l", ["border-top-left-radius", "border-bottom-left-radius"]],
  ["rounded-tl", ["border-top-left-radius"]],
  ["rounded-tr", ["border-top-right-radius"]],
  ["rounded-br", ["border-bottom-right-radius"]],
  ["rounded-bl", ["border-bottom-left-radius"]],
  // #321 logical corners (Tailwind 4.3): none -> 0, full -> calc(infinity * 1px) like Tailwind.
  ["rounded-s", ["border-start-start-radius", "border-end-start-radius"]],
  ["rounded-e", ["border-start-end-radius", "border-end-end-radius"]],
  ["rounded-ss", ["border-start-start-radius"]],
  ["rounded-se", ["border-start-end-radius"]],
  ["rounded-es", ["border-end-start-radius"]],
  ["rounded-ee", ["border-end-end-radius"]],
].forEach(([name, props]) => {
  const propList = props as string[];
  const logical = propList[0].startsWith("border-start") || propList[0].startsWith("border-end");
  // Static utilities
  staticUtility(`${name}-none`, propList.map(prop => [prop, logical ? "0" : "0px"]), { category: 'borders' });
  staticUtility(`${name}-sm`, propList.map(prop => [prop, "var(--radius-sm)"]), { category: 'borders' });
  staticUtility(`${name}`, propList.map(prop => [prop, "0.25rem"]), { category: 'borders' });
  staticUtility(`${name}-md`, propList.map(prop => [prop, "var(--radius-md)"]), { category: 'borders' });
  staticUtility(`${name}-lg`, propList.map(prop => [prop, "var(--radius-lg)"]), { category: 'borders' });
  staticUtility(`${name}-xl`, propList.map(prop => [prop, "var(--radius-xl)"]), { category: 'borders' });
  staticUtility(`${name}-2xl`, propList.map(prop => [prop, "var(--radius-2xl)"]), { category: 'borders' });
  staticUtility(`${name}-3xl`, propList.map(prop => [prop, "var(--radius-3xl)"]), { category: 'borders' });
  staticUtility(`${name}-4xl`, propList.map(prop => [prop, "var(--radius-4xl)"]), { category: 'borders' });
  staticUtility(`${name}-xs`, propList.map(prop => [prop, "var(--radius-xs)"]), { category: 'borders' });
  // #336 every *-full → calc(infinity * 1px) like Tailwind 4.3.3; #300 a custom `full` key wins either way.
  roundedFull(`${name}-full`, propList);

  // Functional utility
  functionalUtility({
    name: name as string,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value, ctx }) => {
      // Tailwind 4.3 has no bare-number logical radius (rounded-s-2 emits nothing).
      if (!logical && parseNumber(value)) {
        return `calc(var(--spacing) * ${value})`;
      }
      return themeKeyVar(ctx, "borderRadius", value, "radius"); // #300: rounded-t-card
    },
    handle: (value) => propList.map(prop => decl(prop, value)),
    description: `${name} utility (spacing, arbitrary, custom property support)`,
    category: "borders",
  });
});


// Functional border radius utility
functionalUtility({
  name: "rounded",
  // Only the `rounded` prefix itself: a class the logical rounded-s/e/... utility rejects (rounded-s-2) must not fall
  // through to border-radius (#321).
  handle: (value, _ctx, token) => (token.prefix === "rounded" ? [decl("border-radius", value)] : null),
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value, ctx }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    return themeKeyVar(ctx, "borderRadius", value, "radius"); // #300: rounded-card → var(--radius-card)
  },
  description: "border-radius utility (spacing, arbitrary, custom property support)",
  category: "borders",
});

// --- Border Width ---
//  border-width documentation

// Like Tailwind v4, every border-width utility also sets border-style through a registered var whose initial value is
// solid, so a bare border/border-t renders without relying on a preflight reset, and border-dashed/dotted/none (which
// set the var) still win whatever the rule order.
const borderStyleProperty = () => atRoot([property("--baro-border-style", "solid")]);
// #344: a borderWidth theme key reads its :root var (`--border-width-<key>`), as Tailwind 4.3.3, so runtime overrides reach it.
const borderWidthRef = (value: string, extra?: { themeKey?: string }) =>
  extra?.themeKey && extra.themeKey !== "DEFAULT" ? `var(--border-width-${extra.themeKey.replace(".", "\\.")})` : value;

const withBorderStyle = (props: string[], width: string) => [
  borderStyleProperty(),
  ...props.map((prop) => decl(prop.replace("width", "style"), "var(--baro-border-style)")),
  ...props.map((prop) => decl(prop, width)),
];

// Static border width utilities
[["border-0", "0px"], ["border-2", "2px"], ["border-4", "4px"], ["border-8", "8px"], ["border", "1px"]].forEach(([name, width]) => {
  staticUtility(name, [borderStyleProperty, ["border-style", "var(--baro-border-style)"], ["border-width", width]], { category: 'borders' });
});



// Individual side border width utilities
[
  ["border-x", ["border-inline-width"]], // #344: logical, as Tailwind 4.3.3 (flips in RTL)
  ["border-y", ["border-block-width"]],
  ["border-bs", ["border-block-start-width"]],
  ["border-be", ["border-block-end-width"]],
  ["border-s", ["border-inline-start-width"]], // #311 (Tailwind 4.3)
  ["border-e", ["border-inline-end-width"]],
  ["border-t", ["border-top-width"]],
  ["border-r", ["border-right-width"]],
  ["border-b", ["border-bottom-width"]],
  ["border-l", ["border-left-width"]],
].forEach(([name, props]) => {
  const propList = props as string[];
  // Static utilities
  const styled = (width: string) => [
    borderStyleProperty,
    ...propList.map((prop) => [prop.replace("width", "style"), "var(--baro-border-style)"] as [string, string]),
    ...propList.map((prop) => [prop, width] as [string, string]),
  ];
  staticUtility(`${name}-0`, styled("0px"));
  staticUtility(`${name}-2`, styled("2px"));
  staticUtility(`${name}-4`, styled("4px"));
  staticUtility(`${name}-8`, styled("8px"));
  staticUtility(`${name}`, styled("1px"));

  // Functional utility
  functionalUtility({
    name: name as string,
    themeKeys: ["colors", "borderWidth"], // #338: a key in both is a colour, as in Tailwind
    supportsOpacity: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) {
        return `${value}px`;
      }
      return null;
    },
    handle: (value, ctx, token, extra) => {
      if (extra?.themeNamespace === "borderWidth") return withBorderStyle(propList, borderWidthRef(value, extra));
      if (extra?.realThemeValue) return propList.flatMap(prop => themeColorDecls(prop.replace("width", "color"), value, extra));
      if (parseColor(value)) {
        return propList.map(prop => decl(prop.replace("width", "color"), value));
      }
      if (token.arbitrary) {
        return withBorderStyle(propList, value);
      }
      // #344: a bare number (border-x-3 → 3px) is a width here; returning null fell through to border-* (all sides).
      if (parseLength(value)) return withBorderStyle(propList, value);
      return null;
    },
    handleCustomProperty: (value) => {

      if (value.startsWith("length:")) {
        return withBorderStyle(propList, `var(${value.replace("length:", "")})`);
      }

      return propList.map(prop => decl(prop.replace("width", "color"), `var(${value})`));
    },
    description: `${name} utility (number, arbitrary, custom property support)`,
    category: "borders",
  });
});

// --- Border Color ---
//  border-color documentation

// Static border color utilities
staticUtility("border-inherit", [["border-color", "inherit"]], { category: 'borders' });
staticUtility("border-current", [["border-color", "currentColor"]], { category: 'borders' });
staticUtility("border-transparent", [["border-color", "transparent"]], { category: 'borders' });

// --- Border Style ---
//  border-style documentation

// Static border style utilities
staticUtility("border-solid", [["--baro-border-style", "solid"], ["border-style", "solid"]], { category: 'borders' });
staticUtility("border-dashed", [["--baro-border-style", "dashed"], ["border-style", "dashed"]], { category: 'borders' });
staticUtility("border-dotted", [["--baro-border-style", "dotted"], ["border-style", "dotted"]], { category: 'borders' });
staticUtility("border-double", [["--baro-border-style", "double"], ["border-style", "double"]], { category: 'borders' });
staticUtility("border-hidden", [["--baro-border-style", "hidden"], ["border-style", "hidden"]], { category: 'borders' });
staticUtility("border-none", [["--baro-border-style", "none"], ["border-style", "none"]], { category: 'borders' });

// --- Divide Width --- (Tailwind 4: `:where(& > :not(:last-child))`, style from the registered border-style var)
const divideSides = { x: ["border-inline-start", "border-inline-end", "border-inline-style"], y: ["border-top", "border-bottom", "border-bottom-style", "border-top-style"] };
Object.entries(divideSides).forEach(([axis, [start, end, ...styles]]) => {
  const rev = `--baro-divide-${axis}-reverse`;
  const divide = (width: string) => [
    borderStyleProperty(),
    rule(":where(& > :not(:last-child))", [
      decl(rev, "0"),
      ...styles.map((s) => decl(s, "var(--baro-border-style)")),
      decl(`${start}-width`, `calc(${width} * var(${rev}))`),
      decl(`${end}-width`, `calc(${width} * calc(1 - var(${rev})))`),
    ]),
  ];
  staticUtility(`divide-${axis}`, divide("1px"), { category: 'borders' });
  staticUtility(`divide-${axis}-reverse`, [rule(":where(& > :not(:last-child))", [decl(rev, "1")])], { category: 'borders' });
  functionalUtility({
    name: `divide-${axis}`,
    themeKeys: ["divideWidth", "borderWidth"], // #338, as Tailwind's --divide-width then --border-width
    supportsArbitrary: true,
    supportsCustomProperty: true, // #344: divide-x-(--w) is a width in Tailwind 4.3.3, never a colour
    handleCustomProperty: (value) => divide(`var(${value.replace(/^length:/, "")})`),
    handleBareValue: ({ value }) => (/^\d+$/.test(value) ? `${value}px` : null),
    handle: (value, _ctx, _token, extra) => divide(extra?.themeNamespace === "borderWidth" ? borderWidthRef(value, extra) : value),
    description: `divide-${axis} width utility`,
    category: "borders",
  });
});


// Functional border width utility
functionalUtility({
  name: "border",
  themeKeys: ["colors", "borderWidth"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {

    if (extra?.themeNamespace === "borderWidth") return withBorderStyle(["border-width"], borderWidthRef(value, extra));
    if (extra?.realThemeValue) return themeColorDecls("border-color", value, extra);

    if (token.arbitrary) {
      if (parseLength(value)) {
        return withBorderStyle(["border-width"], value);
      }
      return [decl("border-color", value)];
    }

    if (parseNumber(value)) {
      return withBorderStyle(["border-width"], `${value}px`);
    }
    if (parseColor(value)) {
      return [decl("border-color", value)];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("length:")) {
      return withBorderStyle(["border-width"], `var(${value.replace("length:", "")})`);
    }
    return [decl("border-color", `var(${value})`)];
  },
  description: "border-width utility (number, arbitrary, custom property support)",
  category: "borders",
});

// --- Outline Width ---
//  outline-width documentation

// Like border (and Tailwind v4), outline width utilities set outline-style through a registered var whose initial value
// is solid, so outline-2/focus-visible:outline-1 render; outline-dashed/none/hidden set the var and win in either order.
const outlineStyleProperty = () => atRoot([property("--baro-outline-style", "solid")]);
const withOutlineStyle = (width: string) => [
  outlineStyleProperty(),
  decl("outline-style", "var(--baro-outline-style)"),
  decl("outline-width", width),
];

// Static outline width utilities
[["outline-0", "0px"], ["outline-1", "1px"], ["outline-2", "2px"], ["outline-4", "4px"], ["outline-8", "8px"]].forEach(([name, width]) => {
  staticUtility(name, [outlineStyleProperty, ["outline-style", "var(--baro-outline-style)"], ["outline-width", width]], { category: 'borders' });
});

// --- Outline Color ---
//  outline-color documentation

// Static outline color utilities
staticUtility("outline-inherit", [["outline-color", "inherit"]], { category: 'borders' });
staticUtility("outline-current", [["outline-color", "currentColor"]], { category: 'borders' });
staticUtility("outline-transparent", [["outline-color", "transparent"]], { category: 'borders' });


// --- Outline Style ---
//  outline-style documentation

// Static outline style utilities
// Tailwind v4: outline-none removes the outline; outline-hidden (v3's outline-none) hides it but keeps a transparent
// outline in forced-colors mode for accessibility.
staticUtility("outline-none", [["--baro-outline-style", "none"], ["outline-style", "none"]], { category: 'borders' });
staticUtility("outline-hidden", [
  ["--baro-outline-style", "none"],
  ["outline-style", "none"],
  atRule("media", "(forced-colors: active)", [decl("outline", "2px solid transparent"), decl("outline-offset", "2px")]),
], { category: 'borders' });
staticUtility("outline", [outlineStyleProperty, ["outline-style", "var(--baro-outline-style)"], ["outline-width", "1px"]], { category: 'borders' });
["solid", "dashed", "dotted", "double"].forEach((style) => {
  staticUtility(`outline-${style}`, [["--baro-outline-style", style], ["outline-style", style]], { category: 'borders' });
});

// --- Outline Offset ---
//  outline-offset documentation

// Static outline offset utilities
staticUtility("outline-offset-0", [["outline-offset", "0px"]], { category: 'borders' });
staticUtility("outline-offset-1", [["outline-offset", "1px"]], { category: 'borders' });
staticUtility("outline-offset-2", [["outline-offset", "2px"]], { category: 'borders' });
staticUtility("outline-offset-4", [["outline-offset", "4px"]], { category: 'borders' });
staticUtility("outline-offset-8", [["outline-offset", "8px"]], { category: 'borders' });

// Functional outline offset utility
functionalUtility({
  name: "outline-offset",
  prop: "outline-offset",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `${value}px`;
    }
    return null;
  },
  description: "outline-offset utility (number, arbitrary, custom property support)",
  category: "borders",
});


// Functional outline color utility
functionalUtility({
  name: "outline",
  themeKeys: ["colors", "outlineWidth"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {

    if (extra?.themeNamespace === "outlineWidth") return withOutlineStyle(value);
    if (extra?.realThemeValue) return themeColorDecls("outline-color", value, extra);

    if (parseColor(value)) {
      return [decl("outline-color", value)];
    }

    if (parseNumber(value)) {
      return withOutlineStyle(`${value}px`);
    }

    // Handle arbitrary values
    if (token.arbitrary) {

      if (parseLength(value)) {
        return withOutlineStyle(value);
      }

      return [decl("outline-color", value)];
    }



    return null;
  },
  handleCustomProperty: (value) => {

    if (value.startsWith("color:")) {
      return [decl("outline-color", `var(${value.slice(6)})`)];
    }

    if (value.startsWith("length:")) {
      return withOutlineStyle(`var(${value.replace("length:", "")})`);
    }

    return [decl("outline-color", `var(${value})`)];
  },
  description: "outline-color utility (theme colors, arbitrary, custom property support)",
  category: "borders",
});


// Functional outline width utility
functionalUtility({
  name: "outline",
  prop: "outline-width",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `${value}px`;
    }
    return null;
  },
  description: "outline-width utility (number, arbitrary, custom property support)",
  category: "borders",
});

// --- Divide Color --- (Tailwind 4: `:where(& > :not(:last-child)) { border-color: … }`, same selector as divide-x/y)
const divideColor = (value: string) => [rule(":where(& > :not(:last-child))", [decl("border-color", value)])];
staticUtility("divide-inherit", divideColor("inherit"), { category: 'borders' });
staticUtility("divide-current", divideColor("currentColor"), { category: 'borders' });
staticUtility("divide-transparent", divideColor("transparent"), { category: 'borders' });
functionalUtility({
  name: "divide",
  themeKeys: ["colors"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, _ctx, token, extra) => {
    // #344: divide-x-<colour> / divide-y-<colour> fall through to here; Tailwind 4.3.3 emits nothing for them.
    if (token.prefix !== "divide") return null;
    // Theme colours go through the shared helper (var(--color-*) and Tailwind's /alpha form, #228).
    if (extra?.realThemeValue) {
      return [rule(":where(& > :not(:last-child))", themeColorDecls("border-color", value, extra))];
    }
    // Arbitrary values only when they are colours: divide-[3px] is not a divide colour (Tailwind emits nothing).
    if (parseColor(value) || /^var\(--[\w-]+\)$/.test(value)) return divideColor(value);
    return null;
  },
  handleCustomProperty: (value, _ctx, token) => (token.prefix === "divide" ? divideColor(`var(${value})`) : []),
  description: "divide-color utility (theme, alpha, arbitrary, custom property)",
  category: "borders",
});
