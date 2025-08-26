import { functionalModifier } from "../../core/registry";
import { AstNode, atRule, rule } from "../../core/ast";
import { CssmaContext } from "../../core/context";
import { ParsedModifier } from "../../core/parser";

// Dark variant plugin
const getDarkSelectors = (ctx: CssmaContext) => {
  const mode = ctx.config("darkMode") || "media";
  const custom = ctx.config("darkModeSelector");
  const selectors: { type: "media" | "selector"; value: string }[] = [];

  if (mode === "media") {
    selectors.push({ type: "media", value: "(prefers-color-scheme: dark)" });
    if (custom) {
      const joined = Array.isArray(custom) ? custom.join(", ") : custom;
      selectors.push({ type: "selector", value: joined });
    }
    return selectors;
  }
  if (mode === "class") {
    if (custom) {
      const joined = Array.isArray(custom) ? custom.join(", ") : custom;
      selectors.push({ type: "selector", value: joined });
      return selectors;
    }
    selectors.push({ type: "selector", value: ".dark" });
    return selectors;
  }
  selectors.push({ type: "selector", value: ".dark" });
  return selectors;
};

functionalModifier(
  (mod: string) => mod === "dark",
  undefined, // modifySelector is not used
  (_mod: ParsedModifier, ctx: CssmaContext) => {
    const selectors = getDarkSelectors(ctx);
    
    const result: AstNode[] = [];

    selectors.forEach((sel) => {
      if (sel.type === "media") {
        const atRuleNode = atRule("media", sel.value, [], 'dark');
        result.push(atRuleNode);
      } else {
        const ruleNode = rule(sel.value, [], 'dark');
        result.push(ruleNode);
      }
    });

    return result;
  }
); 
