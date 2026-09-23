import { validateUi } from './contract.js';
import { renderTree } from './renderer.js';

export function runMockPipeline(raw, { resolveClass, runtime, preview, now = () => performance.now() }) {
  const start = now();
  const { tree, errors, cssByClass } = validateUi(raw, resolveClass);
  const firstValidNode = tree ? now() - start : null;
  preview.replaceChildren();
  if (!tree) return { tree: null, errors, css: { classRules: {}, rootRules: {}, themeVarsAndPreflight: 'managed by BrowserRuntime' }, timingsMs: { firstValidNode, firstStyleReady: null, complete: now() - start }, usage: null, renderedPreview: null };

  const element = renderTree(tree, preview.ownerDocument);
  preview.append(element);
  const classes = [...cssByClass.keys()];
  if (classes.length) runtime.addClass(classes);
  // This confirms a checked computed style and visibility, not a painted frame.
  const style = preview.ownerDocument.defaultView.getComputedStyle(element);
  const visible = element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const expectedStyle = tree.classes.includes('text-center') ? style.textAlign === 'center' :
    tree.classes.includes('block') ? style.display === 'block' : null;
  const firstStyleReady = expectedStyle === true && visible ? now() - start : null;
  if (expectedStyle === false || (expectedStyle === true && !visible)) {
    errors.push({ nodeId: tree.id, code: 'STYLE_NOT_READY', detail: '예상 계산 스타일 또는 가시성 검사 실패' });
  }
  const classRules = {};
  const rootRules = {};
  for (const [cls, rules] of cssByClass) {
    classRules[cls] = rules.classRule;
    if (rules.rootRule) rootRules[cls] = rules.rootRule;
  }
  return {
    tree, errors,
    css: { classRules, rootRules, themeVarsAndPreflight: 'managed by BrowserRuntime' },
    timingsMs: { firstValidNode, firstStyleReady, complete: now() - start },
    usage: null,
    renderedPreview: tree.id,
  };
}
