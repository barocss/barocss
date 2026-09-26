import { parseNumber } from "../core/utils";
import { staticUtility, functionalUtility } from "../core/registry";
import { atRoot, decl, property, rule } from "../core/ast";

// Padding utilities (p-*, px-*, py-*, ps-*, pe-*, pt-*, pr-*, pb-*, pl-*)
[
  ["px", "padding-inline"],
  ["py", "padding-block"],
  ["ps", "padding-inline-start"],
  ["pe", "padding-inline-end"],
  ["pbs", "padding-block-start"],
  ["pbe", "padding-block-end"],
  ["pt", "padding-top"],
  ["pr", "padding-right"],
  ["pb", "padding-bottom"],
  ["pl", "padding-left"],
  ["p", "padding"],
].forEach(([name, prop]) => {
  staticUtility(`${name}-px`, [[prop, "1px"]], { category: 'spacing' });
  functionalUtility({
    spacingKeys: true,
    name,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => (parseNumber(value) ? `calc(var(--spacing) * ${value})` : null),
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
  ["mbs", "margin-block-start"],
  ["mbe", "margin-block-end"],
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
    spacingKeys: true,
    name,
    prop,
    supportsNegative: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => (parseNumber(value) ? `calc(var(--spacing) * ${value})` : null),
    handleNegativeBareValue: ({ value }) => (parseNumber(value) ? `calc(var(--spacing) * -${value})` : null),
    description: `${name} margin utility (number, negative, arbitrary, custom property, auto, px supported)`,
    category: "spacing",
  });
});

// --- Spacing: space-x, space-y, space-x-reverse, space-y-reverse ---
// Tailwind 4 form: margin on the end of every non-last child
// (`:where(& > :not(:last-child))`), not the v3 `> :not([hidden]) ~ :not([hidden])`.
const SPACE_SELECTOR = ":where(& > :not(:last-child))";

(["x", "y"] as const).forEach((axis) => {
  const name = `space-${axis}`;
  const rev = `--baro-space-${axis}-reverse`;
  const [start, end] =
    axis === "x"
      ? ["margin-inline-start", "margin-inline-end"]
      : ["margin-block-start", "margin-block-end"];
  const reverseProperty = () => atRoot([property(rev, "0")]);
  const spaceRule = (v: string) =>
    rule(SPACE_SELECTOR, [
      decl(rev, "0"),
      decl(start, `calc(${v} * var(${rev}))`),
      decl(end, `calc(${v} * calc(1 - var(${rev})))`),
    ]);
  const body = (v: string) => [reverseProperty(), spaceRule(v)];

  staticUtility(`${name}-px`, [reverseProperty, () => spaceRule("1px")], { category: "spacing" });
  staticUtility(`-${name}-px`, [reverseProperty, () => spaceRule("-1px")], { category: "spacing" });
  staticUtility(`${name}-reverse`, [
    reverseProperty,
    () => rule(SPACE_SELECTOR, [decl(rev, "1")]),
  ], { category: "spacing" });

  functionalUtility({
    spacingKeys: true,
    name,
    supportsNegative: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => (parseNumber(value) ? `calc(var(--spacing) * ${value})` : null),
    handleNegativeBareValue: ({ value }) => (parseNumber(value) ? `calc(var(--spacing) * -${value})` : null),
    handle: (value, _ctx, token) => {
      let v = String(value);
      if (/^-?\d+(\.\d+)?$/.test(v)) {
        v = `calc(var(--spacing) * ${token.negative ? "-" : ""}${v})`;
      }
      return body(v);
    },
    handleCustomProperty: (value) => body(`var(${value})`),
    description: `${name} utility (number, negative, px, arbitrary, custom property, reverse supported)`,
    category: "spacing",
  });
});
