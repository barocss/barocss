import { staticUtility, functionalUtility } from "../core/registry";
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
staticUtility("rounded-full", [["border-radius", "9999px"]], { category: 'borders' });


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
].forEach(([name, props]) => {
  const propList = props as string[];
  // Static utilities
  staticUtility(`${name}-none`, propList.map(prop => [prop, "0px"]), { category: 'borders' });
  staticUtility(`${name}-sm`, propList.map(prop => [prop, "var(--radius-sm)"]), { category: 'borders' });
  staticUtility(`${name}`, propList.map(prop => [prop, "0.25rem"]), { category: 'borders' });
  staticUtility(`${name}-md`, propList.map(prop => [prop, "var(--radius-md)"]), { category: 'borders' });
  staticUtility(`${name}-lg`, propList.map(prop => [prop, "var(--radius-lg)"]), { category: 'borders' });
  staticUtility(`${name}-xl`, propList.map(prop => [prop, "var(--radius-xl)"]), { category: 'borders' });
  staticUtility(`${name}-2xl`, propList.map(prop => [prop, "var(--radius-2xl)"]), { category: 'borders' });
  staticUtility(`${name}-3xl`, propList.map(prop => [prop, "var(--radius-3xl)"]), { category: 'borders' });
  staticUtility(`${name}-4xl`, propList.map(prop => [prop, "var(--radius-4xl)"]), { category: 'borders' });
  staticUtility(`${name}-xs`, propList.map(prop => [prop, "var(--radius-xs)"]), { category: 'borders' });
  staticUtility(`${name}-full`, propList.map(prop => [prop, "9999px"]), { category: 'borders' });

  // Functional utility
  functionalUtility({
    name: name as string,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) {
        return `calc(var(--spacing) * ${value})`;
      }
      return null;
    },
    handle: (value) => propList.map(prop => decl(prop, value)),
    description: `${name} utility (spacing, arbitrary, custom property support)`,
    category: "borders",
  });
});


// Functional border radius utility
functionalUtility({
  name: "rounded",
  prop: "border-radius",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    return null;
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
  ["border-x", ["border-left-width", "border-right-width"]],
  ["border-y", ["border-top-width", "border-bottom-width"]],
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
    themeKeys: ["borderWidth", "colors"],
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
      if (extra?.realThemeValue) return propList.flatMap(prop => themeColorDecls(prop.replace("width", "color"), value, extra));
      if (parseColor(value)) {
        return propList.map(prop => decl(prop.replace("width", "color"), value));
      }
      if (token.arbitrary) {
        return withBorderStyle(propList, value);
      }
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
    supportsArbitrary: true,
    handleBareValue: ({ value }) => (/^\d+$/.test(value) ? `${value}px` : null),
    handle: (value) => divide(value),
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
  themeKeys: ["colors", "borderWidth"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {

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
      return [decl("outline-color", value.replace("color:", ""))];
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
  handle: (value, _ctx, _token, extra) => {
    // Theme colours go through the shared helper (var(--color-*) and Tailwind's /alpha form, #228).
    if (extra?.realThemeValue) {
      return [rule(":where(& > :not(:last-child))", themeColorDecls("border-color", value, extra))];
    }
    // Arbitrary values only when they are colours: divide-[3px] is not a divide colour (Tailwind emits nothing).
    if (parseColor(value)) return divideColor(value);
    return null;
  },
  handleCustomProperty: (value) => divideColor(`var(${value})`),
  description: "divide-color utility (theme, alpha, arbitrary, custom property)",
  category: "borders",
});
