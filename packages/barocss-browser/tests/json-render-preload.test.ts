import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime, collectJsonRenderClassNames, preloadJsonRenderClasses } from '../src';

let runtime: BrowserRuntime;

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  runtime = new BrowserRuntime();
});

afterEach(() => {
  runtime.destroy();
  vi.restoreAllMocks();
});

describe('json-render class preload', () => {
  it('collects unique literal className values from the flat element map', () => {
    const spec = {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { className: ' p-4  flex\nmd:block ' }, children: ['title'] },
        title: { type: 'Text', props: { className: 'flex text-center' } },
        dynamic: { type: 'Text', props: { className: { $state: '/class' } } },
      },
      state: { className: 'bg-red-500' },
    };

    expect(collectJsonRenderClassNames(spec)).toEqual(['p-4', 'flex', 'md:block', 'text-center']);
  });

  it('ignores malformed nodes and unrelated className data', () => {
    expect(collectJsonRenderClassNames({ elements: {
      valid: { props: { className: 'm-2' } },
      missingProps: null,
      nested: { props: { label: { className: 'hidden' } } },
    } })).toEqual(['m-2']);
    expect(collectJsonRenderClassNames({ elements: [] })).toEqual([]);
    expect(collectJsonRenderClassNames(null)).toEqual([]);
  });

  it('injects CSS before the renderer attaches the json-render UI', () => {
    const spec = { root: 'root', elements: {
      root: { type: 'Card', props: { className: 'p-4 text-center' } },
    } };

    const classes = preloadJsonRenderClasses(spec, runtime);
    expect(classes).toEqual(['p-4', 'text-center']);
    expect(runtime.has('p-4')).toBe(true);
    expect(runtime.has('text-center')).toBe(true);
    const css = Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-barocss="partition"]'))
      .flatMap(style => Array.from(style.sheet?.cssRules ?? [], rule => rule.cssText))
      .join('\n');
    expect(css).toContain('.p-4');
    expect(document.body.childElementCount).toBe(0);

    const element = document.createElement('div');
    element.className = spec.elements.root.props.className;
    document.body.append(element);
    expect(element.isConnected).toBe(true);
  });
});
