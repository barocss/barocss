import { staticModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";

// --- Media feature variants ---
staticModifier('prefers-contrast-more', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-contrast: more)', ast)]
});
staticModifier('prefers-contrast-less', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-contrast: less)', ast)]
});
staticModifier('forced-colors', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(forced-colors: active)', ast)]
});
staticModifier('pointer-coarse', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(pointer: coarse)', ast)]
});
staticModifier('pointer-fine', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(pointer: fine)', ast)]
});
staticModifier('any-pointer-coarse', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(any-pointer: coarse)', ast)]
});
staticModifier('any-pointer-fine', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(any-pointer: fine)', ast)]
});

// Motion variants
staticModifier('motion-safe', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-reduced-motion: no-preference)', ast)]
});
staticModifier('motion-reduce', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-reduced-motion: reduce)', ast)]
});

// Print and orientation variants
staticModifier('print', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', 'print', ast)]
});
staticModifier('portrait', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(orientation: portrait)', ast)]
});
staticModifier('landscape', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(orientation: landscape)', ast)]
}); 