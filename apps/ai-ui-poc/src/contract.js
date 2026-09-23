export const LIMITS = Object.freeze({ maxBytes: 12000, maxDepth: 6, maxNodes: 40, maxText: 240, maxClasses: 12 });

// These classes are a fixed PoC subset. Mirror's selected Tailwind 4.1.13
// fixtures and Guard's four browser checks are the starting evidence.
export const ALLOWED_CLASSES = Object.freeze([
  'block', 'hidden', 'overflow-hidden', 'text-center', 'bg-red-500',
  'grid-cols-2', 'field-sizing-content', 'hover:block', 'md:block',
]);
const classSet = new Set(ALLOWED_CLASSES);
const componentProps = Object.freeze({
  Stack: [],
  Text: ['text'],
  Button: ['label', 'actionId'],
  Card: [],
  Image: ['src', 'alt'],
});
const actionIds = new Set(['show_notice']);
const imageSources = new Set(['/ai-ui-placeholder.svg']);
const tagPattern = /<\s*\/?\s*[a-z][^>]*>/i;
const idPattern = /^[a-z][a-z0-9_-]{0,39}$/;

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sameKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function validateUi(raw, resolveClass) {
  const errors = [];
  const cssByClass = new Map();
  const ids = new Set();
  let count = 0;
  const error = (nodeId, code, detail) => errors.push({ nodeId, code, detail });
  if (typeof resolveClass !== 'function') throw new TypeError('resolveClass is required');

  let size;
  try { size = new TextEncoder().encode(JSON.stringify(raw)).length; }
  catch { error('$', 'SCHEMA', 'JSON으로 표현할 수 없는 입력'); return { tree: null, errors, cssByClass }; }
  if (size > LIMITS.maxBytes) {
    error('$', 'LIMIT', `JSON 크기 ${LIMITS.maxBytes}바이트 초과`);
    return { tree: null, errors, cssByClass };
  }

  function visit(input, depth) {
    const nodeId = plainObject(input) && typeof input.id === 'string' ? input.id : '$';
    if (depth > LIMITS.maxDepth || ++count > LIMITS.maxNodes) {
      error(nodeId, 'LIMIT', '트리 깊이 또는 노드 수 초과');
      return null;
    }
    if (!plainObject(input) || !sameKeys(input, ['id', 'component', 'props', 'classes', 'children'])) {
      error(nodeId, 'SCHEMA', '노드 형식 또는 키가 올바르지 않음');
      return null;
    }
    const { id, component, props, classes, children } = input;
    if (typeof id !== 'string' || !idPattern.test(id) || ids.has(id)) {
      error(nodeId, 'SCHEMA', 'id 형식이 잘못됐거나 중복됨');
      return null;
    }
    ids.add(id);
    if (!Object.hasOwn(componentProps, component)) {
      error(id, 'SCHEMA', '등록되지 않은 컴포넌트');
      return null;
    }
    if (!plainObject(props) || !sameKeys(props, componentProps[component]) ||
      !Array.isArray(classes) || classes.length > LIMITS.maxClasses || !Array.isArray(children)) {
      error(id, 'SCHEMA', '속성·클래스·자식 형식이 올바르지 않음');
      return null;
    }
    const safeProps = {};
    for (const key of componentProps[component]) {
      const value = props[key];
      if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.maxText || tagPattern.test(value)) {
        error(id, 'SCHEMA', `${key} 값이 올바르지 않음`);
        return null;
      }
      safeProps[key] = value;
    }
    if (component === 'Button' && !actionIds.has(props.actionId)) {
      error(id, 'SCHEMA', '등록되지 않은 행동 ID');
      return null;
    }
    if (component === 'Image' && !imageSources.has(props.src)) {
      error(id, 'SCHEMA', '허용되지 않은 이미지 URL');
      return null;
    }
    if ((component === 'Text' || component === 'Button' || component === 'Image') && children.length) {
      error(id, 'SCHEMA', '이 컴포넌트에는 자식을 넣을 수 없음');
      return null;
    }
    const safeClasses = [];
    for (const cls of classes) {
      if (typeof cls !== 'string' || !classSet.has(cls)) {
        error(id, 'REJECTED_CLASS', String(cls).slice(0, 80));
        continue;
      }
      if (safeClasses.includes(cls)) continue;
      let result;
      try { result = resolveClass(cls); }
      catch { result = null; }
      if (!result || typeof result.css !== 'string' || !result.css.trim() ||
        /url\s*\(/i.test(`${result.css} ${result.rootCss || ''}`)) {
        error(id, 'UNSUPPORTED_CLASS', cls);
        continue;
      }
      safeClasses.push(cls);
      cssByClass.set(cls, { classRule: result.css, rootRule: result.rootCss || '' });
    }
    const safeChildren = [];
    for (const child of children) {
      const safeChild = visit(child, depth + 1);
      if (!safeChild) return null;
      safeChildren.push(safeChild);
    }
    return { id, component, props: safeProps, classes: safeClasses, children: safeChildren };
  }

  const tree = visit(raw, 1);
  // A structural failure rejects the whole tree. No partially valid DOM is inserted.
  if (!tree) cssByClass.clear();
  return { tree, errors, cssByClass };
}
