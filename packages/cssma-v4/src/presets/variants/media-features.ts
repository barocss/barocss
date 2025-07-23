import { staticModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";

// --- Media feature variants ---
staticModifier('prefers-contrast-more', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-contrast: more)', [])]
});
staticModifier('prefers-contrast-less', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-contrast: less)', [])]
});
staticModifier('forced-colors', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(forced-colors: active)', [])]
});
staticModifier('pointer-coarse', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(pointer: coarse)', [])]
});
staticModifier('pointer-fine', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(pointer: fine)', [])]
});
staticModifier('any-pointer-coarse', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(any-pointer: coarse)', [])]
});
staticModifier('any-pointer-fine', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(any-pointer: fine)', [])]
});

// Motion variants
staticModifier('motion-safe', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-reduced-motion: no-preference)', [])]
});
staticModifier('motion-reduce', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-reduced-motion: reduce)', [])]
});

// Print and orientation variants
staticModifier('print', ['&'], {
  order: 5,
  wrap: () => [atRule('media', 'print', [])]
});
staticModifier('portrait', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(orientation: portrait)', [])]
});
staticModifier('landscape', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(orientation: landscape)', [])]
}); 