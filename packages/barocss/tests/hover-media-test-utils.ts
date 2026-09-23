import type { AstNode } from '../src/core/ast';
import type { Context } from '../src/core/context';
import { parseClassToAst } from '../src/core/engine';

// Existing selector tests check the variant below the hover media layer.
// hover-media.test.ts checks the complete layer in generated CSS and AST.
export function parseWithoutHoverMedia(className: string, ctx: Context): AstNode[] {
  function strip(nodes: AstNode[]): AstNode[] {
    return nodes.flatMap((node): AstNode[] => {
      if (node.type === 'at-rule' && node.name === 'media' && node.params === '(hover: hover)') {
        return strip(node.nodes);
      }
      if ('nodes' in node) return [{ ...node, nodes: strip(node.nodes) }];
      return [node];
    });
  }

  return strip(parseClassToAst(className, ctx));
}
