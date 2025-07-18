import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: { red: { 500: "#f00" } },
    breakpoint: {
      sm: "(min-width: 640px)",
      md: "(min-width: 768px)",
      lg: "(min-width: 1024px)",
      xl: "(min-width: 1280px)",
    },
  },
});

describe("modifier/variant system", () => {
  it("hover:bg-red-500 → &:hover { background-color: #f00 }", () => {
    expect(applyClassName("hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("sm:hover:bg-red-500 → @media (min-width: 640px) { &:hover { ... } }", () => {
    expect(applyClassName("sm:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("group-hover:bg-red-500 → .group:hover & { ... }", () => {
    expect(applyClassName("group-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("peer-hover:bg-red-500 → .peer:hover ~ & { ... }", () => {
    expect(applyClassName("peer-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".peer:hover ~ &",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("aria-pressed:bg-red-500 → [aria-pressed=\"true\"] & { ... }", () => {
    expect(applyClassName("aria-pressed:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '[aria-pressed="true"] &',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("aria-[pressed=false]:bg-red-500 → [aria-pressed=\"false\"] & { ... }", () => {
    expect(applyClassName("aria-[pressed=false]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '[aria-pressed="false"] &',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(applyClassName("[&>*]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&>*",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(applyClassName("not-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(applyClassName("group-hover:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &:focus",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("md:bg-red-500 → @media (min-width: 768px) { & { ... } }", () => {
    expect(applyClassName("md:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 768px)",
        nodes: [
          {
            type: "rule",
            selector: "&",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("xl:hover:bg-red-500 → @media (min-width: 1280px) { &:hover { ... } }", () => {
    expect(applyClassName("xl:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1280px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("disabled:bg-red-500 → &:disabled { ... }", () => {
    expect(applyClassName("disabled:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:disabled",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("checked:bg-red-500 → &:checked { ... }", () => {
    expect(applyClassName("checked:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:checked",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("required:bg-red-500 → &:required { ... }", () => {
    expect(applyClassName("required:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:required",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("invalid:bg-red-500 → &:invalid { ... }", () => {
    expect(applyClassName("invalid:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:invalid",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("first:bg-red-500 → &:first-child { ... }", () => {
    expect(applyClassName("first:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:first-child",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("last:bg-red-500 → &:last-child { ... }", () => {
    expect(applyClassName("last:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:last-child",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("only:bg-red-500 → &:only-child { ... }", () => {
    expect(applyClassName("only:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:only-child",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("even:bg-red-500 → &:nth-child(2n) { ... }", () => {
    expect(applyClassName("even:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:nth-child(even)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("odd:bg-red-500 → &:nth-child(odd) { ... }", () => {
    expect(applyClassName("odd:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:nth-child(odd)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("first-of-type:bg-red-500 → &:first-of-type { ... }", () => {
    expect(applyClassName("first-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:first-of-type",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("last-of-type:bg-red-500 → &:last-of-type { ... }", () => {
    expect(applyClassName("last-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:last-of-type",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("only-of-type:bg-red-500 → &:only-of-type { ... }", () => {
    expect(applyClassName("only-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:only-of-type",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("empty:bg-red-500 → &:empty { ... }", () => {
    expect(applyClassName("empty:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:empty",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(applyClassName("not-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("not-checked:bg-red-500 → &:not(:checked) { ... }", () => {
    expect(applyClassName("not-checked:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:checked)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("not-disabled:bg-red-500 → &:not(:disabled) { ... }", () => {
    expect(applyClassName("not-disabled:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:disabled)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(applyClassName("not-[open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not([open])",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("aria-[expanded=true]:bg-red-500 → [aria-expanded=\"true\"] & { ... }", () => {
    expect(applyClassName("aria-[expanded=true]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '[aria-expanded="true"] &',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("data-[state=open]:bg-red-500 → [data-state=\"open\"] & { ... }", () => {
    expect(applyClassName("data-[state=open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[data-state="open"]',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("[open]:bg-red-500 → [open] & { ... }", () => {
    expect(applyClassName("[open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[open]',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("[dir=rtl]:bg-red-500 → [dir=rtl] & { ... }", () => {
    expect(applyClassName("[dir=rtl]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[dir=rtl]',
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(applyClassName("[&>*]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&>*",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(applyClassName("group-hover:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &:focus",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("sm:hover:bg-red-500 → @media (min-width: 640px) { &:hover { ... } }", () => {
    expect(applyClassName("sm:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("before:bg-red-500 → &::before { ... }", () => {
    expect(applyClassName("before:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::before",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("after:bg-red-500 → &::after { ... }", () => {
    expect(applyClassName("after:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::after",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("placeholder:bg-red-500 → &::placeholder { ... }", () => {
    expect(applyClassName("placeholder:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::placeholder",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("selection:bg-red-500 → &::selection { ... }", () => {
    expect(applyClassName("selection:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::selection",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("marker:bg-red-500 → &::marker { ... }", () => {
    expect(applyClassName("marker:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::marker",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("dark:sm:hover:bg-red-500 → .dark @media (min-width: 640px) { &:hover { ... } }", () => {
    expect(applyClassName("dark:sm:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-color-scheme: dark)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 640px)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "background-color", value: "#f00" },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("group-hover:not-disabled:bg-red-500 → .group:hover &:not(:disabled) { ... }", () => {
    expect(applyClassName("group-hover:not-disabled:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &:not(:disabled)",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("peer-checked:focus:bg-red-500 → .peer:checked ~ &:focus { ... }", () => {
    expect(applyClassName("peer-checked:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".peer:checked ~ &:focus",
        nodes: [
          { type: "decl", prop: "background-color", value: "#f00" },
        ],
      },
    ]);
  });

  it("sm:peer-checked:focus:bg-red-500 → @media (min-width: 640px) { .peer:checked ~ &:focus { ... } }", () => {
    expect(applyClassName("sm:peer-checked:focus:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: ".peer:checked ~ &:focus",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("dark:aria-[expanded=true]:bg-red-500 → .dark [aria-expanded=\"true\"] & { ... }", () => {
    expect(applyClassName("dark:aria-[expanded=true]:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-color-scheme: dark)",
        nodes: [
          {
            type: "rule",
            selector: "[aria-expanded=\"true\"] &",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("sm:[&>*]:bg-red-500 → @media (min-width: 640px) { &>* { ... } }", () => {
    expect(applyClassName("sm:[&>*]:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&>*",
            nodes: [
              { type: "decl", prop: "background-color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("enabled:bg-red-500 → &:enabled { ... }", () => {
    expect(applyClassName("enabled:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:enabled", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("indeterminate:bg-red-500 → &:indeterminate { ... }", () => {
    expect(applyClassName("indeterminate:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:indeterminate", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("default:bg-red-500 → &:default { ... }", () => {
    expect(applyClassName("default:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:default", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("optional:bg-red-500 → &:optional { ... }", () => {
    expect(applyClassName("optional:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:optional", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("valid:bg-red-500 → &:valid { ... }", () => {
    expect(applyClassName("valid:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:valid", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("user-valid:bg-red-500 → &:user-valid { ... }", () => {
    expect(applyClassName("user-valid:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:user-valid", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("user-invalid:bg-red-500 → &:user-invalid { ... }", () => {
    expect(applyClassName("user-invalid:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:user-invalid", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("in-range:bg-red-500 → &:in-range { ... }", () => {
    expect(applyClassName("in-range:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:in-range", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("out-of-range:bg-red-500 → &:out-of-range { ... }", () => {
    expect(applyClassName("out-of-range:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:out-of-range", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("placeholder-shown:bg-red-500 → &:placeholder-shown { ... }", () => {
    expect(applyClassName("placeholder-shown:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:placeholder-shown", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("autofill:bg-red-500 → &:autofill { ... }", () => {
    expect(applyClassName("autofill:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:autofill", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("read-only:bg-red-500 → &:read-only { ... }", () => {
    expect(applyClassName("read-only:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:read-only", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("details-content:bg-red-500 → &::details-content { ... }", () => {
    expect(applyClassName("details-content:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&::details-content", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("first-line:bg-red-500 → &::first-line { ... }", () => {
    expect(applyClassName("first-line:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&::first-line", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("first-letter:bg-red-500 → &::first-letter { ... }", () => {
    expect(applyClassName("first-letter:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&::first-letter", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("backdrop:bg-red-500 → &::backdrop { ... }", () => {
    expect(applyClassName("backdrop:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&::backdrop", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("file:bg-red-500 → &::file-selector-button { ... }", () => {
    expect(applyClassName("file:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&::file-selector-button", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("motion-safe:hover:bg-red-500 → @media (prefers-reduced-motion: no-preference) { &:hover { ... } }", () => {
    expect(applyClassName("motion-safe:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-reduced-motion: no-preference)",
        nodes: [
          { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("motion-reduce:hover:bg-red-500 → @media (prefers-reduced-motion: reduce) { &:hover { ... } }", () => {
    expect(applyClassName("motion-reduce:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-reduced-motion: reduce)",
        nodes: [
          { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("print:hover:bg-red-500 → @media print { &:hover { ... } }", () => {
    expect(applyClassName("print:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "print",
        nodes: [
          { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("portrait:hover:bg-red-500 → @media (orientation: portrait) { &:hover { ... } }", () => {
    expect(applyClassName("portrait:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(orientation: portrait)",
        nodes: [
          { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("landscape:hover:bg-red-500 → @media (orientation: landscape) { &:hover { ... } }", () => {
    expect(applyClassName("landscape:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(orientation: landscape)",
        nodes: [
          { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("2xl:bg-red-500 → @media (min-width: 1536px) { & { ... } }", () => {
    expect(applyClassName("2xl:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1536px)",
        nodes: [
          {
            type: "rule",
            selector: "&",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }]
          }
        ]
      }
    ]);
  });
  it("rtl:bg-red-500 → &[dir=rtl] { ... }", () => {
    expect(applyClassName("rtl:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&[dir=rtl]", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("ltr:bg-red-500 → &[dir=ltr] { ... }", () => {
    expect(applyClassName("ltr:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&[dir=ltr]", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("inert:bg-red-500 → &[inert] { ... }", () => {
    expect(applyClassName("inert:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&[inert]", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("open:bg-red-500 → &[open] { ... }", () => {
    expect(applyClassName("open:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:is([open], :popover-open, :open)", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(applyClassName("not-[open]:bg-red-500", ctx)).toEqual([
      { type: "rule", selector: "&:not([open])", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
    ]);
  });
  it("prefers-contrast-more:bg-red-500 → @media (prefers-contrast: more) { & { ... } }", () => {
    expect(applyClassName("prefers-contrast-more:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: more)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("prefers-contrast-less:bg-red-500 → @media (prefers-contrast: less) { & { ... } }", () => {
    expect(applyClassName("prefers-contrast-less:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: less)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("forced-colors:bg-red-500 → @media (forced-colors: active) { & { ... } }", () => {
    expect(applyClassName("forced-colors:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(forced-colors: active)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("pointer-coarse:bg-red-500 → @media (pointer: coarse) { & { ... } }", () => {
    expect(applyClassName("pointer-coarse:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: coarse)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("pointer-fine:bg-red-500 → @media (pointer: fine) { & { ... } }", () => {
    expect(applyClassName("pointer-fine:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: fine)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("any-pointer-coarse:bg-red-500 → @media (any-pointer: coarse) { & { ... } }", () => {
    expect(applyClassName("any-pointer-coarse:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(any-pointer: coarse)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("any-pointer-fine:bg-red-500 → @media (any-pointer: fine) { & { ... } }", () => {
    expect(applyClassName("any-pointer-fine:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(any-pointer: fine)",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
  it("supports-[display:grid]:bg-red-500 → @supports (display:grid) { & { ... } }", () => {
    expect(applyClassName("supports-[display:grid]:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "supports",
        params: "display:grid",
        nodes: [
          { type: "rule", selector: "&", nodes: [{ type: "decl", prop: "background-color", value: "#f00" }] }
        ]
      }
    ]);
  });
});

describe('variants - 확장 플러그인', () => {
  it('nth-child, nth-last-child, nth-of-type, nth-last-of-type', () => {
    expect(applyClassName('nth-3:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:nth-child(3)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('nth-last-2:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:nth-last-child(2)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('nth-of-type-4:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:nth-of-type(4)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('nth-last-of-type-5:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:nth-last-of-type(5)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('is-[], where-[], has-[] variants', () => {
    expect(applyClassName('is-[.foo]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:is(.foo)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('where-[.bar]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:where(.bar)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('has-[.baz]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:has(.baz)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('group/peer/parent/child 확장', () => {
    expect(applyClassName('group-focus:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.group:focus &',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('peer-active:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.peer:active ~ &',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('parent-open:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.parent:open &',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
    expect(applyClassName('child-hover:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '& > .child:hover',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
});

describe('variants - 최신 CSS at-rule 플러그인', () => {
  it('container-[] variant', () => {
    expect(applyClassName('container-[min-width:400px]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'min-width:400px',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });
  it('layer-[] variant', () => {
    expect(applyClassName('layer-[components]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'layer',
        params: 'components',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });
  it('scope-[] variant', () => {
    expect(applyClassName('scope-[.foo]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'scope',
        params: '.foo',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });
});

describe('variants - @container query 플러그인', () => {
  it('@sm:bg-red-500 → @container (min-width: 24rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(min-width: 24rem)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('@max-md:bg-red-500 → @container (max-width: 28rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@max-md:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(max-width: 28rem)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('@min-[475px]:bg-red-500 → @container (min-width: 475px) { ... }', () => {
    expect(applyClassName('@min-[475px]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(min-width: 475px)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('@container/main:bg-red-500 → @container main { ... }', () => {
    expect(applyClassName('@container/main:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('@sm/main:bg-red-500 → @container main (min-width: 24rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm/main:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main (min-width: 24rem)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('@min-[475px]/main:bg-red-500 → @container main (min-width: 475px) { ... }', () => {
    expect(applyClassName('@min-[475px]/main:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main (min-width: 475px)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('중첩: @sm:@max-md:bg-red-500', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm:@max-md:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(min-width: 24rem)',
        nodes: [
          {
            type: 'at-rule',
            name: 'container',
            params: '(max-width: 28rem)',
            nodes: [
              { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
            ],
          },
        ],
      },
    ]);
  });
  it('starting:bg-red-500 → @starting-style { ... }', () => {
    expect(applyClassName('starting:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'starting-style',
        params: '',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
});

describe('variants - dark mode config', () => {
  it('darkMode: media (default)', () => {
    const ctx = createContext({ darkMode: 'media', theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(prefers-color-scheme: dark)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('darkMode: class', () => {
    const ctx = createContext({ darkMode: 'class', theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.dark',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('darkMode: custom selector', () => {
    const ctx = createContext({ darkMode: 'class', darkModeSelector: [':where([data-theme=dark], [data-theme=dark] *)', ':where(.dark, .dark *)'], theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: ':where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('darkMode: [class, custom]', () => {
    const ctx = createContext({ darkMode: 'class', darkModeSelector: [':where([data-theme=dark], [data-theme=dark] *)', ':where(.dark, .dark *)'], theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: ':where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
  it('darkMode: [media, class]', () => {
    const ctx = createContext({ darkMode: 'media', darkModeSelector: ['.dark'], theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(prefers-color-scheme: dark)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
      {
        type: 'rule',
        selector: '.dark',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] },
        ],
      },
    ]);
  });
});

describe('variants - dark mode advanced scenarios', () => {
  it('dark:sm:bg-red-500 with darkMode: class', () => {
    const ctx = createContext({ darkMode: 'class', theme: { colors: { red: { 500: '#f00' } }, breakpoint: { sm: '(min-width: 640px)' } } });
    expect(applyClassName('dark:sm:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.dark',
        nodes: [
          {
            type: 'at-rule',
            name: 'media',
            params: '(min-width: 640px)',
            nodes: [
              {
                type: 'rule',
                selector: '&',
                nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ]
              }
            ]
          }
        ]
      }
    ]);
  });

  it('sm:dark:bg-red-500 with darkMode: media', () => {
    const ctx = createContext({ darkMode: 'media', theme: { colors: { red: { 500: '#f00' } }, breakpoint: { sm: '(min-width: 640px)' } } });
    expect(applyClassName('sm:dark:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 640px)',
        nodes: [
          {
            type: 'at-rule',
            name: 'media',
            params: '(prefers-color-scheme: dark)',
            nodes: [
              {
                type: 'rule',
                selector: '&',
                nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ]
              }
            ]
          }
        ]
      }
    ]);
  });

  it('dark:container-[min-width:400px]:bg-red-500 with darkMode: [class, custom]', () => {
    const ctx = createContext({ darkMode: 'class', darkModeSelector: [':where([data-theme=dark], [data-theme=dark] *)', ':where(.dark, .dark *)'], theme: { colors: { red: { 500: '#f00' } } } });
    expect(applyClassName('dark:container-[min-width:400px]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: ':where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)',
        nodes: [
          {
            type: 'at-rule',
            name: 'container',
            params: 'min-width:400px',
            nodes: [
              {
                type: 'rule',
                selector: '&',
                nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ]
              }
            ]
          }
        ]
      },
    ]);
  });

  it('dark:sm:container-[min-width:400px]:bg-red-500 with darkMode: class', () => {
    const ctx = createContext({ darkMode: 'class', theme: { colors: { red: { 500: '#f00' } }, breakpoint: { sm: '(min-width: 640px)' } } });
    expect(applyClassName('dark:sm:container-[min-width:400px]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.dark',
        nodes: [
          {
            type: 'at-rule',
            name: 'media',
            params: '(min-width: 640px)',
            nodes: [
              {
                type: 'at-rule',
                name: 'container',
                params: 'min-width:400px',
                nodes: [
                  {
                    type: 'rule',
                    selector: '&',
                    nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);
  });
});

describe('variants - dark mode ', () => {
  it('dark:bg-red-500 with darkModeSelector: [":where([data-theme=dark], [data-theme=dark] *)", ":where(.dark, .dark *)"]', () => {
    const ctx = createContext({
      darkMode: 'class',
      darkModeSelector: [':where([data-theme=dark], [data-theme=dark] *)', ':where(.dark, .dark *)'],
      theme: { colors: { red: { 500: '#f00' } } }
    });
    expect(applyClassName('dark:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: ':where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)',
        nodes: [
          { type: 'rule', selector: '&', nodes: [ { type: 'decl', prop: 'background-color', value: '#f00' } ] }
        ]
      }
    ]);
  });
});

describe('variants - has-[]', () => {
  it('has-[.child]:bg-red-500 → &:has(.child) { ... }', () => {
    expect(applyClassName('has-[.child]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:has(.child)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('group-hover:has-[.child]:bg-red-500 → .group:hover &:has(.child) { ... }', () => {
    expect(applyClassName('group-hover:has-[.child]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.group:hover &:has(.child)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('has-[.foo>.bar]:bg-blue-500 → &:has(.foo>.bar) { ... }', () => {
    const ctx2 = createContext({ theme: { colors: { blue: { 500: '#00f' } } } });
    expect(applyClassName('has-[.foo>.bar]:bg-blue-500', ctx2)).toEqual([
      {
        type: 'rule',
        selector: '&:has(.foo>.bar)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#00f' },
        ],
      },
    ]);
  });
});

describe('variants - arbitrary ', () => {
  it('[&>*]:bg-red-500 → &>* { ... }', () => {
    expect(applyClassName('[&>*]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&>*',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('aria-[pressed=true]:bg-red-500 → [aria-pressed="true"] & { ... }', () => {
    expect(applyClassName('aria-[pressed=true]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '[aria-pressed="true"] &',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('data-[state=open]:bg-red-500 → &[data-state="open"] { ... }', () => {
    expect(applyClassName('data-[state=open]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&[data-state="open"]',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('is-[.foo]:bg-red-500 → &:is(.foo) { ... }', () => {
    expect(applyClassName('is-[.foo]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:is(.foo)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('where-[.bar]:bg-red-500 → &:where(.bar) { ... }', () => {
    expect(applyClassName('where-[.bar]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:where(.bar)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
});

describe('arbitrary variants ', () => {
  it('[&:hover]:bg-red-500 → &:hover { ... }', () => {
    expect(applyClassName('[&:hover]:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:hover', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('[.foo>.bar]:bg-blue-500 → .foo>.bar { ... }', () => {
    const ctx2 = createContext({ theme: { colors: { blue: { 500: '#00f' } } } });
    expect(applyClassName('[.foo>.bar]:bg-blue-500', ctx2)).toEqual([
      { type: 'rule', selector: '.foo>.bar &', nodes: [{ type: 'decl', prop: 'background-color', value: '#00f' }] }
    ]);
  });
  it('group-hover:[&>*]:bg-red-500 → .group:hover &>* { ... }', () => {
    expect(applyClassName('group-hover:[&>*]:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '.group:hover &>*', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('dark:[.foo]:hover:bg-blue-500 → .dark .foo:hover { ... }', () => {
    const ctx2 = createContext({ darkMode: 'class', theme: { colors: { blue: { 500: '#00f' } } } });
    expect(applyClassName('dark:[.foo]:hover:bg-blue-500', ctx2)).toEqual([
      {
        type: 'rule',
        selector: '.dark',
        nodes: [
          { type: 'rule', selector: '.foo &:hover', nodes: [{ type: 'decl', prop: 'background-color', value: '#00f' }] }
        ]
      }
    ]);
  });
});

describe('not- variant (negation)', () => {
  it('not-hover:bg-red-500 → &:not(:hover) { ... }', () => {
    expect(applyClassName('not-hover:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:not(:hover)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('not-[open]:bg-red-500 → &:not([open]) { ... }', () => {
    expect(applyClassName('not-[open]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:not([open])',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('not-[aria-pressed=true]:bg-red-500 → &:not([aria-pressed="true"]) { ... }', () => {
    expect(applyClassName('not-[aria-pressed=true]:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '&:not([aria-pressed=true])',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
  it('group-hover:not-hover:bg-red-500 → .group:hover &:not(:hover) { ... }', () => {
    expect(applyClassName('group-hover:not-hover:bg-red-500', ctx)).toEqual([
      {
        type: 'rule',
        selector: '.group:hover &:not(:hover)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
});

// not- variant(negation) 추가 케이스 (기존 테스트 아래에 append)
describe('not- variant (negation)', () => {
  it('not-focus:bg-red-500 → &:not(:focus)', () => {
    expect(applyClassName('not-focus:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not(:focus)', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('not-[dir=rtl]:bg-red-500 → &:not([dir=rtl])', () => {
    expect(applyClassName('not-[dir=rtl]:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not([dir=rtl])', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('not-[.foo]:bg-red-500 → &:not(.foo)', () => {
    expect(applyClassName('not-[.foo]:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not(.foo)', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('not-[.foo>.bar]:bg-red-500 → &:not(.foo>.bar)', () => {
    expect(applyClassName('not-[.foo>.bar]:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not(.foo>.bar)', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('not-hover:focus:bg-red-500 → &:not(:hover):focus', () => {
    expect(applyClassName('not-hover:focus:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not(:hover):focus', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
  it('not-hover:not-focus:bg-red-500 → &:not(:hover):not(:focus)', () => {
    expect(applyClassName('not-hover:not-focus:bg-red-500', ctx)).toEqual([
      { type: 'rule', selector: '&:not(:hover):not(:focus)', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
    ]);
  });
}); 