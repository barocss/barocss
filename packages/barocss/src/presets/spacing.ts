import { staticUtility, functionalUtility } from "../core/registry";
import { decl, rule } from "../core/ast";

// Padding utilities (p-*, px-*, py-*, ps-*, pe-*, pt-*, pr-*, pb-*, pl-*)
[
  ["px", "padding-inline"],
  ["py", "padding-block"],
  ["ps", "padding-inline-start"],
  ["pe", "padding-inline-end"],
  ["pt", "padding-top"],
  ["pr", "padding-right"],
  ["pb", "padding-bottom"],
  ["pl", "padding-left"],
  ["p", "padding"],
].forEach(([name, prop]) => {
  staticUtility(`${name}-px`, [[prop, "1px"]], { category: 'spacing' });
  functionalUtility({
    name,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
    description: `${name} utility (number, arbitrary, custom property supported)`,
    category: "spacing",
  });
});

// Margin utilities (m-*, mx-*, my-*, ms-*, me-*, mt-*, mr-*, mb-*, ml-*)
[
  ["mx", "margin-inline"],
  ["my", "margin-block"],
  ["ms", "margin-inline-start"],
  ["me", "margin-inline-end"],
  ["mt", "margin-top"],
  ["mr", "margin-right"],
  ["mb", "margin-bottom"],
  ["ml", "margin-left"],
  ["m", "margin"],
].forEach(([name, prop]) => {
  staticUtility(`${name}-auto`, [[prop, "auto"]], { category: 'spacing' });
  staticUtility(`${name}-px`, [[prop, "1px"]], { category: 'spacing' });
  staticUtility(`-${name}-px`, [[prop, "-1px"]], { category: 'spacing' });
  functionalUtility({
    name,
    prop,
    supportsNegative: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
    handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
    description: `${name} margin utility (number, negative, arbitrary, custom property, auto, px supported)`,
    category: "spacing",
  });
});

// --- Spacing: space-x, space-y, space-x-reverse, space-y-reverse ---
//  spacing utilities reference

// space-x-*, -space-x-*, space-x-px, -space-x-px, space-x-[...], space-x-(...)

staticUtility("space-x-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-x-reverse", "0"],
      [
        "margin-inline-start",
        "calc(1px * calc(1 - var(--tw-space-x-reverse)))",
      ],
      ["margin-inline-end", "calc(1px * var(--tw-space-x-reverse))"],
    ],
  ],
], { category: 'spacing' });
staticUtility("-space-x-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-x-reverse", "0"],
      [
        "margin-inline-start",
        "calc(-1px * calc(1 - var(--tw-space-x-reverse)))",
      ],
      ["margin-inline-end", "calc(-1px * var(--tw-space-x-reverse))"],
    ],
  ],
], { category: 'spacing' });
staticUtility("space-x-reverse", [
  ["& > :not([hidden]) ~ :not([hidden])", [["--tw-space-x-reverse", "1"]]],
], { category: 'spacing' });

functionalUtility({
  name: "space-x",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
  handle: (value, ctx, token) => {
    let v = value;
    if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(v)) {
      v = `calc(var(--spacing) * ${token.negative ? "-" : ""}${v})`;
    }
    return [
      rule("& > :not([hidden]) ~ :not([hidden])", [
        decl("--tw-space-x-reverse", "0"),
        decl(
          "margin-inline-start",
          `calc(${v} * calc(1 - var(--tw-space-x-reverse)))`
        ),
        decl("margin-inline-end", `calc(${v} * var(--tw-space-x-reverse))`),
      ]),
    ];
  },
  handleCustomProperty: (value) => [
    rule("& > :not([hidden]) ~ :not([hidden])", [
      decl("--tw-space-x-reverse", "0"),
      decl(
        "margin-inline-start",
        `calc(var(${value}) * calc(1 - var(--tw-space-x-reverse)))`
      ),
      decl(
        "margin-inline-end",
        `calc(var(${value}) * var(--tw-space-x-reverse))`
      ),
    ]),
  ],
  description:
    "space-x utility (number, negative, px, arbitrary, custom property, reverse supported)",
  category: "spacing",
});

// space-y-*, -space-y-*, space-y-px, -space-y-px, space-y-[...], space-y-(...)

staticUtility("space-y-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-y-reverse", "0"],
      ["margin-block-start", "calc(1px * calc(1 - var(--tw-space-y-reverse)))"],
      ["margin-block-end", "calc(1px * var(--tw-space-y-reverse))"],
    ],
  ],
], { category: 'spacing' });
staticUtility("-space-y-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-y-reverse", "0"],
      [
        "margin-block-start",
        "calc(-1px * calc(1 - var(--tw-space-y-reverse)))",
      ],
      ["margin-block-end", "calc(-1px * var(--tw-space-y-reverse))"],
    ],
  ],
], { category: 'spacing' });
staticUtility("space-y-reverse", [
  ["& > :not([hidden]) ~ :not([hidden])", [["--tw-space-y-reverse", "1"]]],
], { category: 'spacing' });

functionalUtility({
  name: "space-y",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
  handle: (value, ctx, token) => {
    let v = value;
    if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(v)) {
      v = `calc(var(--spacing) * ${token.negative ? "-" : ""}${v})`;
    }
    return [
      rule("& > :not([hidden]) ~ :not([hidden])", [
        decl("--tw-space-y-reverse", "0"),
        decl(
          "margin-block-start",
          `calc(${v} * calc(1 - var(--tw-space-y-reverse)))`
        ),
        decl("margin-block-end", `calc(${v} * var(--tw-space-y-reverse))`),
      ]),
    ];
  },
  handleCustomProperty: (value) => [
    rule("& > :not([hidden]) ~ :not([hidden])", [
      decl("--tw-space-y-reverse", "0"),
      decl(
        "margin-block-start",
        `calc(var(${value}) * calc(1 - var(--tw-space-y-reverse)))`
      ),
      decl(
        "margin-block-end",
        `calc(var(${value}) * var(--tw-space-y-reverse))`
      ),
    ]),
  ],
  description:
    "space-y utility (number, negative, px, arbitrary, custom property, reverse supported)",
  category: "spacing",
});