import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import { parseNumber, parseLength, parseColor } from "../core/utils";

// --- Border Radius ---
// https://tailwindcss.com/docs/border-radius

// Static border radius utilities
staticUtility("rounded-none", [["border-radius", "0px"]]);
staticUtility("rounded-sm", [["border-radius", "var(--radius-sm)"]]);
staticUtility("rounded", [["border-radius", "var(--radius)"]]);
staticUtility("rounded-md", [["border-radius", "var(--radius-md)"]]);
staticUtility("rounded-lg", [["border-radius", "var(--radius-lg)"]]);
staticUtility("rounded-xl", [["border-radius", "var(--radius-xl)"]]);
staticUtility("rounded-2xl", [["border-radius", "var(--radius-2xl)"]]);
staticUtility("rounded-3xl", [["border-radius", "var(--radius-3xl)"]]);
staticUtility("rounded-full", [["border-radius", "9999px"]]);


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
  staticUtility(`${name}-none`, propList.map(prop => [prop, "0px"]));
  staticUtility(`${name}-sm`, propList.map(prop => [prop, "var(--radius-sm)"]));
  staticUtility(`${name}`, propList.map(prop => [prop, "var(--radius)"]));
  staticUtility(`${name}-md`, propList.map(prop => [prop, "var(--radius-md)"]));
  staticUtility(`${name}-lg`, propList.map(prop => [prop, "var(--radius-lg)"]));
  staticUtility(`${name}-xl`, propList.map(prop => [prop, "var(--radius-xl)"]));
  staticUtility(`${name}-2xl`, propList.map(prop => [prop, "var(--radius-2xl)"]));
  staticUtility(`${name}-3xl`, propList.map(prop => [prop, "var(--radius-3xl)"]));
  staticUtility(`${name}-full`, propList.map(prop => [prop, "9999px"]));

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
// https://tailwindcss.com/docs/border-width

// Static border width utilities
staticUtility("border-0", [["border-width", "0px"]]);
staticUtility("border-2", [["border-width", "2px"]]);
staticUtility("border-4", [["border-width", "4px"]]);
staticUtility("border-8", [["border-width", "8px"]]);
staticUtility("border", [["border-width", "1px"]]);



// Individual side border width utilities
[
  ["border-x", ["border-left-width", "border-right-width"]],
  ["border-y", ["border-top-width", "border-bottom-width"]],
  ["border-t", ["border-top-width"]],
  ["border-r", ["border-right-width"]],
  ["border-b", ["border-bottom-width"]],
  ["border-l", ["border-left-width"]],
].forEach(([name, props]) => {
  const propList = props as string[];
  // Static utilities
  staticUtility(`${name}-0`, propList.map(prop => [prop, "0px"]));
  staticUtility(`${name}-2`, propList.map(prop => [prop, "2px"]));
  staticUtility(`${name}-4`, propList.map(prop => [prop, "4px"]));
  staticUtility(`${name}-8`, propList.map(prop => [prop, "8px"]));
  staticUtility(`${name}`, propList.map(prop => [prop, "1px"]));

  // Functional utility
  functionalUtility({
    name: name as string,
    themeKeys: ["borderWidth", "colors"],
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) {
        return `${value}px`;
      }
      return null;
    },
    handle: (value, ctx, token) => {
      if (parseColor(value)) {
        return propList.map(prop => decl(prop.replace("width", "color"), value));
      }
      if (token.arbitrary) {
        return propList.map(prop => decl(prop, value));
      }
      return null;
    },
    handleCustomProperty: (value) => {

      if (value.startsWith("length:")) {
        return propList.map(prop => decl(prop, `var(${value.replace("length:", "")})`));
      }

      return propList.map(prop => decl(prop.replace("width", "color"), `var(${value})`));
    },
    description: `${name} utility (number, arbitrary, custom property support)`,
    category: "borders",
  });
});

// --- Border Color ---
// https://tailwindcss.com/docs/border-color

// Static border color utilities
staticUtility("border-inherit", [["border-color", "inherit"]]);
staticUtility("border-current", [["border-color", "currentColor"]]);
staticUtility("border-transparent", [["border-color", "transparent"]]);

// --- Border Style ---
// https://tailwindcss.com/docs/border-style

// Static border style utilities
staticUtility("border-solid", [["border-style", "solid"]]);
staticUtility("border-dashed", [["border-style", "dashed"]]);
staticUtility("border-dotted", [["border-style", "dotted"]]);
staticUtility("border-double", [["border-style", "double"]]);
staticUtility("border-hidden", [["border-style", "hidden"]]);
staticUtility("border-none", [["border-style", "none"]]);


// Functional border width utility
functionalUtility({
  name: "border",
  themeKeys: ["colors", "borderWidth"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {

    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl("border-color", `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`),
          ]),
          decl("border-color", value),
        ];
      }
      return [decl("border-color", value)];
    }

    if (token.arbitrary) {
      if (parseLength(value)) {
        return [decl("border-width", value)];
      }
      return [decl("border-color", value)];
    }

    if (parseNumber(value)) {
      return [decl("border-width", `${value}px`)];
    }
    if (parseColor(value)) {
      return [decl("border-color", value)];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("length:")) {
      return [decl("border-width", `var(${value.replace("length:", "")})`)];
    }
    return [decl("border-color", `var(${value})`)];
  },
  description: "border-width utility (number, arbitrary, custom property support)",
  category: "borders",
});

// --- Outline Width ---
// https://tailwindcss.com/docs/outline-width

// Static outline width utilities
staticUtility("outline-0", [["outline-width", "0px"]]);
staticUtility("outline-1", [["outline-width", "1px"]]);
staticUtility("outline-2", [["outline-width", "2px"]]);
staticUtility("outline-4", [["outline-width", "4px"]]);
staticUtility("outline-8", [["outline-width", "8px"]]);

// --- Outline Color ---
// https://tailwindcss.com/docs/outline-color

// Static outline color utilities
staticUtility("outline-inherit", [["outline-color", "inherit"]]);
staticUtility("outline-current", [["outline-color", "currentColor"]]);
staticUtility("outline-transparent", [["outline-color", "transparent"]]);


// --- Outline Style ---
// https://tailwindcss.com/docs/outline-style

// Static outline style utilities
staticUtility("outline-none", [["outline", "2px solid transparent"], ["outline-offset", "2px"]]);
staticUtility("outline", [["outline-style", "solid"]]);
staticUtility("outline-dashed", [["outline-style", "dashed"]]);
staticUtility("outline-dotted", [["outline-style", "dotted"]]);
staticUtility("outline-double", [["outline-style", "double"]]);

// --- Outline Offset ---
// https://tailwindcss.com/docs/outline-offset

// Static outline offset utilities
staticUtility("outline-offset-0", [["outline-offset", "0px"]]);
staticUtility("outline-offset-1", [["outline-offset", "1px"]]);
staticUtility("outline-offset-2", [["outline-offset", "2px"]]);
staticUtility("outline-offset-4", [["outline-offset", "4px"]]);
staticUtility("outline-offset-8", [["outline-offset", "8px"]]);

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
  handle: (value, ctx, token) => {

    if (parseColor(value)) {
      return [decl("outline-color", value)];
    }

    if (parseNumber(value)) {
      return [decl("outline-width", `${value}px`)];
    }

    // Handle arbitrary values
    if (token.arbitrary) {

      if (parseLength(value)) {
        return [decl("outline-width", value)];
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
      return [decl("outline-width", `var(${value.replace("length:", "")})`)];
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
