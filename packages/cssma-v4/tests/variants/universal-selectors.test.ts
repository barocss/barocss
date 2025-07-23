import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("universal selectors", () => {
  it("*:rounded-full → :is(.*:rounded-full > *)", () => {
    const ast = applyClassName("*:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ":is(.\\*\\:rounded-full > *)",
        nodes: [{ type: "decl", prop: "border-radius", value: "9999px" }],
      },
    ]);
  });

  it("**:rounded-full → :is(.**:rounded-full *)", () => {
    const ast = applyClassName("**:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "style-rule",
        selector: ":is(.\\*\\*\\:rounded-full *)",
        nodes: [
          { type: "decl", prop: "border-radius", value: "9999px" },
        ],
      },
    ]);
  });

  it("*:data-avatar:rounded-full → :is(.*:data-avatar:rounded-full > *)[data-avatar]", () => {
    const ast = applyClassName("*:data-avatar:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "style-rule",
        selector: ":is(.\\*\\:data-avatar\\:rounded-full > *)",
        nodes: [
          {
            type: "rule",
            selector: "&[data-avatar]",
            nodes: [{ type: "decl", prop: "border-radius", value: "9999px" }],
          },
        ],
      },
    ]);
  });

  it("**:data-avatar:rounded-full → :is(.**:data-avatar:rounded-full *)[data-avatar]", () => {
    const ast = applyClassName("**:data-avatar:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "style-rule",
        selector: ":is(.\\*\\*\\:data-avatar\\:rounded-full *)",
        nodes: [
          {
            type: "rule",
            selector: "&[data-avatar]",
            nodes: [{ type: "decl", prop: "border-radius", value: "9999px" }],
          },
        ],
      },
    ]);
  });

  it("group-hover:*:rounded-full → :is(.group-hover\\:\\*:rounded-full > *)", () => {
    const ast = applyClassName("group-hover:*:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          {
            type: "style-rule",
            selector: ":is(.group-hover\\:\\*\\:rounded-full > *)",
            nodes: [{ type: "decl", prop: "border-radius", value: "9999px" }],
          },
        ],
      },
    ]);
  });

  it("group-hover:**:rounded-full → :is(.group-hover:**:rounded-full *)", () => {
    const ast = applyClassName("group-hover:**:rounded-full", ctx);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          {
            type: "style-rule",
            selector: ":is(.group-hover\\:\\*\\*\\:rounded-full *)",
            nodes: [{ type: "decl", prop: "border-radius", value: "9999px" }],
          },
        ],
      },
    ]);
  });
});
