import { functionalModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";
import { CssmaContext } from "../../core/context";
import { ParsedModifier } from "../../core/parser";
import { createContainerRule, createContainerParams, getThemeSize } from "./utils";

// --- @container query variants ---

// 1. @container/main - named container
functionalModifier(
  (mod: string) => /^@container\/([a-zA-Z0-9_-]+)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const containerMatch = /^@container\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (containerMatch) {
      const name = containerMatch[1];
      const params = name; // Just the name, no condition
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 2. @container/size - named container with arbitrary size
functionalModifier(
  (mod: string) => /^@container\/([a-zA-Z0-9_-]+)\s+\(([^)]+)\)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const containerSizeMatch = /^@container\/([a-zA-Z0-9_-]+)\s+\(([^)]+)\)$/.exec(mod.type);
    if (containerSizeMatch) {
      const [, name, size] = containerSizeMatch;
      const params = createContainerParams('min', size, name);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 3. @container/size - theme size with named container
functionalModifier(
  (mod: string) => /^@(sm|md|lg|xl|2xl)\/([a-zA-Z0-9_-]+)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const namedSizeMatch = /^@(sm|md|lg|xl|2xl)\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (namedSizeMatch) {
      const [, size, name] = namedSizeMatch;
      const sizeValue = getThemeSize(context, size) || size;
      const params = createContainerParams('min', sizeValue, name);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 4. @container/size - theme size without named container
functionalModifier(
  (mod: string) => /^@(sm|md|lg|xl|2xl)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const themeSizeMatch = /^@(sm|md|lg|xl|2xl)$/.exec(mod.type);
    if (themeSizeMatch) {
      const size = themeSizeMatch[1];
      const sizeValue = getThemeSize(context, size) || size;
      const params = createContainerParams('min', sizeValue);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 4.5. @max-container/size - max theme size without named container
functionalModifier(
  (mod: string) => /^@max-(sm|md|lg|xl|2xl)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const themeSizeMatch = /^@max-(sm|md|lg|xl|2xl)$/.exec(mod.type);
    if (themeSizeMatch) {
      const size = themeSizeMatch[1];
      const sizeValue = getThemeSize(context, size) || size;
      const params = createContainerParams('max', sizeValue);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 5. @container/size - arbitrary size
functionalModifier(
  (mod: string) => /^@(min|max)-\[.*\]$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const arbitraryMatch = /^@(min|max)-\[(.+)\]$/.exec(mod.type);
    if (arbitraryMatch) {
      const [, type, value] = arbitraryMatch;
      const params = createContainerParams(type as 'min' | 'max', value);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
);

// 6. @container/size - arbitrary size with named container
functionalModifier(
  (mod: string) => /^@(min|max)-\[.*\]\/([a-zA-Z0-9_-]+)$/.test(mod),
  undefined,
  (mod: ParsedModifier, context: CssmaContext) => {
    const arbitraryNamedMatch = /^@(min|max)-\[(.+)\]\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (arbitraryNamedMatch) {
      const [, type, value, name] = arbitraryNamedMatch;
      const params = createContainerParams(type as 'min' | 'max', value, name);
      return [createContainerRule(params, [])];
    }
    return [];
  },
  { order: 5 }
); 