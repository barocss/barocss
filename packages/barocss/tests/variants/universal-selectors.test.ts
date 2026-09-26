import { parseWithoutHoverMedia } from '../hover-media-test-utils';
import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("universal selectors", () => {
  it("*:rounded-full → :is(.*:rounded-full > *)", () => {
    const ast = parseClassToAst("*:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: ":is(& > *)",
        nodes: [{ type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" }],
      },
    ]);
  });

  it("**:rounded-full → :is(.**:rounded-full *)", () => {
    const ast = parseClassToAst("**:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: ":is(& *)",
        nodes: [
          { type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" },
        ],
      },
    ]);
  });

  it("*:data-avatar:rounded-full → :is(.*:data-avatar:rounded-full > *)[data-avatar]", () => {
    const ast = parseClassToAst("*:data-avatar:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: ":is(& > *)",
        nodes: [
          {
            type: "rule",
            selector: "&[data-avatar]",
            nodes: [{ type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" }],
          },
        ],
      },
    ]);
  });

  it("**:data-avatar:rounded-full → :is(.**:data-avatar:rounded-full *)[data-avatar]", () => {
    const ast = parseClassToAst("**:data-avatar:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: ":is(& *)",
        nodes: [
          {
            type: "rule",
            selector: "&[data-avatar]",
            nodes: [{ type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" }],
          },
        ],
      },
    ]);
  });

  it("group-hover:*:rounded-full → :is(.group-hover\\:\\*:rounded-full > *)", () => {
    const ast = parseWithoutHoverMedia("group-hover:*:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
        nodes: [
          {
            type: "rule",
            selector: ":is(& > *)",
            nodes: [{ type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" }],
          },
        ],
      },
    ]);
  });

  it("group-hover:**:rounded-full → :is(.group-hover:**:rounded-full *)", () => {
    const ast = parseWithoutHoverMedia("group-hover:**:rounded-full", ctx);
    expect(ast).toMatchObject([
      {
        type: "rule",
        selector: "&:is(:where(.group):hover *)",
        nodes: [
          {
            type: "rule",
            selector: ":is(& *)",
            nodes: [{ type: "decl", prop: "border-radius", value: "calc(infinity * 1px)" }],
          },
        ],
      },
    ]);
  });
});
