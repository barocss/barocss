import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("basic variants", () => {
  it("hover:bg-red-500 → &:hover { background-color: #f00 }", () => {
    expect(parseClassToAst("hover:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("sm:hover:bg-red-500 → @media (min-width: 640px) { &:hover { ... } }", () => {
    expect(parseClassToAst("sm:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("group-hover:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("peer-hover:bg-red-500 → .peer:hover ~ & { ... }", () => {
    expect(parseClassToAst("peer-hover:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.peer):hover~*)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-pressed:bg-red-500 → [aria-pressed="true"] & { ... }', () => {
    expect(parseClassToAst("aria-pressed:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: '&[aria-pressed="true"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-[pressed=false]:bg-red-500 → [aria-pressed="false"] & { ... }', () => {
    expect(
      parseClassToAst("aria-[pressed=false]:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "rule",
        selector: '&[aria-pressed="false"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(parseClassToAst("[&>*]:bg-red-500", ctx)).toMatchObject([
      {
        type: "style-rule",
        selector: "&>*",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(parseClassToAst("not-hover:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(parseClassToAst("group-hover:focus:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
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
    expect(parseClassToAst("md:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 768px)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("xl:hover:bg-red-500 → @media (min-width: 1280px) { &:hover { ... } }", () => {
    expect(parseClassToAst("xl:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("disabled:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:disabled",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("checked:bg-red-500 → &:checked { ... }", () => {
    expect(parseClassToAst("checked:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:checked",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("required:bg-red-500 → &:required { ... }", () => {
    expect(parseClassToAst("required:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:required",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("invalid:bg-red-500 → &:invalid { ... }", () => {
    expect(parseClassToAst("invalid:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:invalid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first:bg-red-500 → &:first-child { ... }", () => {
    expect(parseClassToAst("first:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:first-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("last:bg-red-500 → &:last-child { ... }", () => {
    expect(parseClassToAst("last:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:last-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("only:bg-red-500 → &:only-child { ... }", () => {
    expect(parseClassToAst("only:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:only-child",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("even:bg-red-500 → &:nth-child(even) { ... }", () => {
    expect(parseClassToAst("even:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:nth-child(even)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("odd:bg-red-500 → &:nth-child(odd) { ... }", () => {
    expect(parseClassToAst("odd:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:nth-child(odd)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-of-type:bg-red-500 → &:first-of-type { ... }", () => {
    expect(parseClassToAst("first-of-type:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:first-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("last-of-type:bg-red-500 → &:last-of-type { ... }", () => {
    expect(parseClassToAst("last-of-type:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:last-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("only-of-type:bg-red-500 → &:only-of-type { ... }", () => {
    expect(parseClassToAst("only-of-type:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:only-of-type",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("empty:bg-red-500 → &:empty { ... }", () => {
    expect(parseClassToAst("empty:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:empty",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
    expect(parseClassToAst("not-hover:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not(:hover)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-checked:bg-red-500 → &:not(:checked) { ... }", () => {
    expect(parseClassToAst("not-checked:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not(:checked)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-disabled:bg-red-500 → &:not(:disabled) { ... }", () => {
    expect(parseClassToAst("not-disabled:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not(:disabled)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(parseClassToAst("not-[open]:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not([open])",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('aria-[expanded=true]:bg-red-500 → [aria-expanded="true"] & { ... }', () => {
    expect(
      parseClassToAst("aria-[expanded=true]:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "rule",
        selector: '&[aria-expanded="true"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it('data-[state=open]:bg-red-500 → [data-state="open"] & { ... }', () => {
    expect(parseClassToAst("data-[state=open]:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: '&[data-state="open"]',
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[open]:bg-red-500 → [open] & { ... }", () => {
    expect(parseClassToAst("[open]:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&[open]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[dir=rtl]:bg-red-500 → [dir=rtl] & { ... }", () => {
    expect(parseClassToAst("[dir=rtl]:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&[dir=rtl]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("[&>*]:bg-red-500 → &>* { ... }", () => {
    expect(parseClassToAst("[&>*]:bg-red-500", ctx)).toMatchObject([
      {
        type: "style-rule",
        selector: "&>*",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("group-hover:focus:bg-red-500 → .group:hover &:focus { ... }", () => {
    expect(parseClassToAst("group-hover:focus:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
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
    expect(parseClassToAst("sm:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("before:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::before",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("after:bg-red-500 → &::after { ... }", () => {
    expect(parseClassToAst("after:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::after",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("placeholder:bg-red-500 → cross-browser placeholder selectors { ... }", () => {
    expect(parseClassToAst("placeholder:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::placeholder",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-webkit-input-placeholder",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-moz-placeholder",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&:-ms-input-placeholder",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("selection:bg-red-500 → cross-browser selection selectors { ... }", () => {
    expect(parseClassToAst("selection:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::selection",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-moz-selection",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("marker:bg-red-500 → cross-browser marker selectors { ... }", () => {
    expect(parseClassToAst("marker:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::marker",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-webkit-details-marker",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-moz-list-bullet",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-moz-list-number",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("dark:sm:hover:bg-red-500 → @media (prefers-color-scheme: dark) { @media (min-width: 640px) { &:hover { ... } } }", () => {
    expect(parseClassToAst("dark:sm:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(
      parseClassToAst("group-hover:not-disabled:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
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
    expect(parseClassToAst("peer-checked:focus:bg-red-500", ctx)).toMatchObject(
      [
        {
          type: "rule",
          selector: "&:is(:where(.peer):checked~*)",
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
      ]
    );
  });

  it("sm:peer-checked:focus:bg-red-500 → @media (min-width: 640px) { .peer:checked ~ &:focus { ... } }", () => {
    expect(
      parseClassToAst("sm:peer-checked:focus:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:is(:where(.peer):checked~*)",
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
    expect(
      parseClassToAst("dark:aria-[expanded=true]:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-color-scheme: dark)",
        nodes: [
          {
            type: "rule",
            selector: '&[aria-expanded="true"]',
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("sm:[&>*]:bg-red-500 → @media (min-width: 640px) { &>* { ... } }", () => {
    expect(parseClassToAst("sm:[&>*]:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: "&>*",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("enabled:bg-red-500 → &:enabled { ... }", () => {
    expect(parseClassToAst("enabled:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:enabled",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("indeterminate:bg-red-500 → &:indeterminate { ... }", () => {
    expect(parseClassToAst("indeterminate:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:indeterminate",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("default:bg-red-500 → &:default { ... }", () => {
    expect(parseClassToAst("default:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:default",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("optional:bg-red-500 → &:optional { ... }", () => {
    expect(parseClassToAst("optional:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:optional",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("valid:bg-red-500 → &:valid { ... }", () => {
    expect(parseClassToAst("valid:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:valid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("user-valid:bg-red-500 → &:user-valid { ... }", () => {
    expect(parseClassToAst("user-valid:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:user-valid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("user-invalid:bg-red-500 → &:user-invalid { ... }", () => {
    expect(parseClassToAst("user-invalid:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:user-invalid",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("in-range:bg-red-500 → &:in-range { ... }", () => {
    expect(parseClassToAst("in-range:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:in-range",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("out-of-range:bg-red-500 → &:out-of-range { ... }", () => {
    expect(parseClassToAst("out-of-range:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:out-of-range",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("placeholder-shown:bg-red-500 → &:placeholder-shown { ... }", () => {
    expect(parseClassToAst("placeholder-shown:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:placeholder-shown",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("autofill:bg-red-500 → &:autofill { ... }", () => {
    expect(parseClassToAst("autofill:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:autofill",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("read-only:bg-red-500 → &:read-only { ... }", () => {
    expect(parseClassToAst("read-only:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:read-only",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("details-content:bg-red-500 → &::details-content { ... }", () => {
    expect(parseClassToAst("details-content:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::details-content",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-line:bg-red-500 → &::first-line { ... }", () => {
    expect(parseClassToAst("first-line:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::first-line",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("first-letter:bg-red-500 → &::first-letter { ... }", () => {
    expect(parseClassToAst("first-letter:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::first-letter",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("backdrop:bg-red-500 → &::backdrop { ... }", () => {
    expect(parseClassToAst("backdrop:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::backdrop",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("file:bg-red-500 → cross-browser file selector button { ... }", () => {
    expect(parseClassToAst("file:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&::file-selector-button",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
      {
        type: "rule",
        selector: "&::-webkit-file-upload-button",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("motion-safe:hover:bg-red-500 → @media (prefers-reduced-motion: no-preference) { &:hover { ... } }", () => {
    expect(parseClassToAst("motion-safe:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(
      parseClassToAst("motion-reduce:hover:bg-red-500", ctx)
    ).toMatchObject([
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
    expect(parseClassToAst("print:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("portrait:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("landscape:hover:bg-red-500", ctx)).toMatchObject([
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
    expect(parseClassToAst("2xl:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1536px)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("rtl:bg-red-500 → &[dir=rtl] { ... }", () => {
    expect(parseClassToAst("rtl:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&[dir=rtl]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("ltr:bg-red-500 → &[dir=ltr] { ... }", () => {
    expect(parseClassToAst("ltr:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&[dir=ltr]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("inert:bg-red-500 → &[inert] { ... }", () => {
    expect(parseClassToAst("inert:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&[inert]",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("open:bg-red-500 → &:is([open], :popover-open, :open) { ... }", () => {
    expect(parseClassToAst("open:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:is([open], :popover-open, :open)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
    expect(parseClassToAst("not-[open]:bg-red-500", ctx)).toMatchObject([
      {
        type: "rule",
        selector: "&:not([open])",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("prefers-contrast-more:bg-red-500 → @media (prefers-contrast: more) { & { ... } }", () => {
    expect(
      parseClassToAst("prefers-contrast-more:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: more)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("prefers-contrast-less:bg-red-500 → @media (prefers-contrast: less) { & { ... } }", () => {
    expect(
      parseClassToAst("prefers-contrast-less:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-contrast: less)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("forced-colors:bg-red-500 → @media (forced-colors: active) { & { ... } }", () => {
    expect(parseClassToAst("forced-colors:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(forced-colors: active)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("pointer-coarse:bg-red-500 → @media (pointer: coarse) { & { ... } }", () => {
    expect(parseClassToAst("pointer-coarse:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: coarse)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("pointer-fine:bg-red-500 → @media (pointer: fine) { & { ... } }", () => {
    expect(parseClassToAst("pointer-fine:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: fine)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("any-pointer-coarse:bg-red-500 → @media (any-pointer: coarse) { & { ... } }", () => {
    expect(parseClassToAst("any-pointer-coarse:bg-red-500", ctx)).toMatchObject(
      [
        {
          type: "at-rule",
          name: "media",
          params: "(any-pointer: coarse)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]
    );
  });

  it("any-pointer-fine:bg-red-500 → @media (any-pointer: fine) { & { ... } }", () => {
    expect(parseClassToAst("any-pointer-fine:bg-red-500", ctx)).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(any-pointer: fine)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });

  it("supports-[display:grid]:bg-red-500 → @supports display:grid { & { ... } }", () => {
    expect(
      parseClassToAst("supports-[display:grid]:bg-red-500", ctx)
    ).toMatchObject([
      {
        type: "at-rule",
        name: "supports",
        params: "(display:grid)",
        nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
      },
    ]);
  });
});
