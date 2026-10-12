import assert from 'node:assert/strict';
import {createMarkdownRenderer} from 'vitepress';

/** Private source-link check. Matches the app's current default Markdown options;
 * it neither imports the side-effectful site config nor replaces a full build. */
export async function createRenderEditorMarkdownAnchors(srcDir) {
  const markdown = await createMarkdownRenderer(srcDir);
  const headingIds = source => {
    // VitePress's own core plugins assign the same IDs consumed by its HTML renderer.
    // A fresh parse environment keeps duplicate-heading counters document-local.
    const tokens = markdown.parse(source, {});
    return new Set(tokens.filter(token => token.type === 'heading_open')
      .map(token => token.attrGet('id')).filter(id => id !== null));
  };
  const assertAnchor = (source, fragment, href = fragment) => {
    assert(headingIds(source).has(decodeURIComponent(fragment)), `Missing heading ${href}`);
  };
  return {headingIds, assertAnchor};
}
