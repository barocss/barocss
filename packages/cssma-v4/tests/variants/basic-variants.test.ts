import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("basic variants", () => {
  it("hover:bg-red-500 → &:hover { background-color: #f00 }", () => {
    expect(applyClassName("hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
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
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
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
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("peer-hover:bg-red-500 → .peer:hover ~ & { ... }", () => {
    expect(applyClassName("peer-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".peer:hover ~ &",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-pressed:bg-red-500 → [aria-pressed="true"] & { ... }', () => {
    expect(applyClassName("aria-pressed:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[aria-pressed="true"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-[pressed=false]:bg-red-500 → [aria-pressed="false"] & { ... }', () => {
    expect(applyClassName("aria-[pressed=false]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[aria-pressed="false"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(applyClassName("[&>*]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&>*",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(applyClassName("not-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(applyClassName("group-hover:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
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
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
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
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
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
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("checked:bg-red-500 → &:checked { ... }", () => {
    expect(applyClassName("checked:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:checked",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("required:bg-red-500 → &:required { ... }", () => {
    expect(applyClassName("required:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:required",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("invalid:bg-red-500 → &:invalid { ... }", () => {
    expect(applyClassName("invalid:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:invalid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first:bg-red-500 → &:first-child { ... }", () => {
    expect(applyClassName("first:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:first-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("last:bg-red-500 → &:last-child { ... }", () => {
    expect(applyClassName("last:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:last-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("only:bg-red-500 → &:only-child { ... }", () => {
    expect(applyClassName("only:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:only-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("even:bg-red-500 → &:nth-child(even) { ... }", () => {
    expect(applyClassName("even:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:nth-child(even)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("odd:bg-red-500 → &:nth-child(odd) { ... }", () => {
    expect(applyClassName("odd:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:nth-child(odd)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-of-type:bg-red-500 → &:first-of-type { ... }", () => {
    expect(applyClassName("first-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:first-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("last-of-type:bg-red-500 → &:last-of-type { ... }", () => {
    expect(applyClassName("last-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:last-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("only-of-type:bg-red-500 → &:only-of-type { ... }", () => {
    expect(applyClassName("only-of-type:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:only-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("empty:bg-red-500 → &:empty { ... }", () => {
    expect(applyClassName("empty:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:empty",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(applyClassName("not-hover:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-checked:bg-red-500 → &:not(:checked) { ... }", () => {
    expect(applyClassName("not-checked:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:checked)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-disabled:bg-red-500 → &:not(:disabled) { ... }", () => {
    expect(applyClassName("not-disabled:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not(:disabled)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(applyClassName("not-[open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not([open])",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-[expanded=true]:bg-red-500 → [aria-expanded="true"] & { ... }', () => {
    expect(applyClassName("aria-[expanded=true]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[aria-expanded="true"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('data-[state=open]:bg-red-500 → [data-state="open"] & { ... }', () => {
    expect(applyClassName("data-[state=open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: '&[data-state="open"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[open]:bg-red-500 → [open] & { ... }", () => {
    expect(applyClassName("[open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&[open]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[dir=rtl]:bg-red-500 → [dir=rtl] & { ... }", () => {
    expect(applyClassName("[dir=rtl]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&[dir=rtl]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(applyClassName("[&>*]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&>*",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(applyClassName("group-hover:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
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
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
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
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("after:bg-red-500 → &::after { ... }", () => {
    expect(applyClassName("after:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::after",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("placeholder:bg-red-500 → cross-browser placeholder selectors { ... }", () => {
    expect(applyClassName("placeholder:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector:
          "&::placeholder, &::-webkit-input-placeholder, &::-moz-placeholder, &:-ms-input-placeholder",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("selection:bg-red-500 → cross-browser selection selectors { ... }", () => {
    expect(applyClassName("selection:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::selection, &::-moz-selection",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("marker:bg-red-500 → cross-browser marker selectors { ... }", () => {
    expect(applyClassName("marker:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector:
          "&::marker, &::-webkit-details-marker, &::-moz-list-bullet, &::-moz-list-number",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("dark:sm:hover:bg-red-500 → @media (prefers-color-scheme: dark) { @media (min-width: 640px) { &:hover { ... } } }", () => {
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
        selector: ".group:hover &",
        nodes: [
          {
            type: "rule",
            selector: "&:not(:disabled)",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("peer-checked:focus:bg-red-500 → .peer:checked ~ &:focus { ... }", () => {
    expect(applyClassName("peer-checked:focus:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: ".peer:checked ~ &",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
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
            selector: ".peer:checked ~ &",
            nodes: [
              {
                type: "rule",
                selector: "&:focus",
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

  it('dark:aria-[expanded=true]:bg-red-500 → @media (prefers-color-scheme: dark) { &[aria-expanded="true"] { ... } }', () => {
    expect(applyClassName("dark:aria-[expanded=true]:bg-red-500", ctx)).toEqual(
      [
        {
          type: "at-rule",
          name: "media",
          params: "(prefers-color-scheme: dark)",
          nodes: [
            {
              type: "rule",
              selector: '&[aria-expanded="true"]',
              nodes: [
                { type: "decl", prop: "background-color", value: "#f00" },
              ],
            },
          ],
        },
      ]
    );
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
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("enabled:bg-red-500 → &:enabled { ... }", () => {
    expect(applyClassName("enabled:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:enabled",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("indeterminate:bg-red-500 → &:indeterminate { ... }", () => {
    expect(applyClassName("indeterminate:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:indeterminate",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("default:bg-red-500 → &:default { ... }", () => {
    expect(applyClassName("default:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:default",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("optional:bg-red-500 → &:optional { ... }", () => {
    expect(applyClassName("optional:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:optional",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("valid:bg-red-500 → &:valid { ... }", () => {
    expect(applyClassName("valid:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:valid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("user-valid:bg-red-500 → &:user-valid { ... }", () => {
    expect(applyClassName("user-valid:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:user-valid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("user-invalid:bg-red-500 → &:user-invalid { ... }", () => {
    expect(applyClassName("user-invalid:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:user-invalid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("in-range:bg-red-500 → &:in-range { ... }", () => {
    expect(applyClassName("in-range:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:in-range",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("out-of-range:bg-red-500 → &:out-of-range { ... }", () => {
    expect(applyClassName("out-of-range:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:out-of-range",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("placeholder-shown:bg-red-500 → &:placeholder-shown { ... }", () => {
    expect(applyClassName("placeholder-shown:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:placeholder-shown",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("autofill:bg-red-500 → &:autofill { ... }", () => {
    expect(applyClassName("autofill:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:autofill",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("read-only:bg-red-500 → &:read-only { ... }", () => {
    expect(applyClassName("read-only:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:read-only",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("details-content:bg-red-500 → &::details-content { ... }", () => {
    expect(applyClassName("details-content:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::details-content",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-line:bg-red-500 → &::first-line { ... }", () => {
    expect(applyClassName("first-line:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::first-line",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-letter:bg-red-500 → &::first-letter { ... }", () => {
    expect(applyClassName("first-letter:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::first-letter",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("backdrop:bg-red-500 → &::backdrop { ... }", () => {
    expect(applyClassName("backdrop:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::backdrop",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("file:bg-red-500 → cross-browser file selector button { ... }", () => {
    expect(applyClassName("file:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&::file-selector-button, &::-webkit-file-upload-button",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("motion-safe:hover:bg-red-500 → @media (prefers-reduced-motion: no-preference) { &:hover { ... } }", () => {
    expect(applyClassName("motion-safe:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-reduced-motion: no-preference)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("motion-reduce:hover:bg-red-500 → @media (prefers-reduced-motion: reduce) { &:hover { ... } }", () => {
    expect(applyClassName("motion-reduce:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-reduced-motion: reduce)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("print:hover:bg-red-500 → @media print { &:hover { ... } }", () => {
    expect(applyClassName("print:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "print",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("portrait:hover:bg-red-500 → @media (orientation: portrait) { &:hover { ... } }", () => {
    expect(applyClassName("portrait:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(orientation: portrait)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("landscape:hover:bg-red-500 → @media (orientation: landscape) { &:hover { ... } }", () => {
    expect(applyClassName("landscape:hover:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(orientation: landscape)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("2xl:bg-red-500 → @media (min-width: 1536px) { & { ... } }", () => {
    expect(applyClassName("2xl:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1536px)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("rtl:bg-red-500 → &[dir=rtl] { ... }", () => {
    expect(applyClassName("rtl:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&[dir=rtl]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("ltr:bg-red-500 → &[dir=ltr] { ... }", () => {
    expect(applyClassName("ltr:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&[dir=ltr]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("inert:bg-red-500 → &[inert] { ... }", () => {
    expect(applyClassName("inert:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&[inert]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("open:bg-red-500 → &:is([open], :popover-open, :open) { ... }", () => {
    expect(applyClassName("open:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:is([open], :popover-open, :open)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(applyClassName("not-[open]:bg-red-500", ctx)).toEqual([
      {
        type: "rule",
        selector: "&:not([open])",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("prefers-contrast-more:bg-red-500 → @media (prefers-contrast: more) { & { ... } }", () => {
    expect(applyClassName("prefers-contrast-more:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: more)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("prefers-contrast-less:bg-red-500 → @media (prefers-contrast: less) { & { ... } }", () => {
    expect(applyClassName("prefers-contrast-less:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: less)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("forced-colors:bg-red-500 → @media (forced-colors: active) { & { ... } }", () => {
    expect(applyClassName("forced-colors:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(forced-colors: active)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("pointer-coarse:bg-red-500 → @media (pointer: coarse) { & { ... } }", () => {
    expect(applyClassName("pointer-coarse:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: coarse)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("pointer-fine:bg-red-500 → @media (pointer: fine) { & { ... } }", () => {
    expect(applyClassName("pointer-fine:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: fine)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("any-pointer-coarse:bg-red-500 → @media (any-pointer: coarse) { & { ... } }", () => {
    expect(applyClassName("any-pointer-coarse:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(any-pointer: coarse)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("any-pointer-fine:bg-red-500 → @media (any-pointer: fine) { & { ... } }", () => {
    expect(applyClassName("any-pointer-fine:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(any-pointer: fine)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("supports-[display:grid]:bg-red-500 → @supports display:grid { & { ... } }", () => {
    expect(applyClassName("supports-[display:grid]:bg-red-500", ctx)).toEqual([
      {
        type: "at-rule",
        name: "supports",
        params: "display:grid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });
});
