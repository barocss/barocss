import { describe, it, expect } from 'vitest';
import { applyClassName } from '../src/core/engine';
import { createContext } from '../src/core/context';

describe('applyClassName', () => {
  it('should produce correct AST for sm:hover:bg-red-500', () => {
    const ctx = createContext({});
    const ast = applyClassName('sm:hover:bg-red-500', ctx);
    expect(ast).toEqual([
      {
        type: 'atrule',
        name: 'media',
        params: '(min-width: 640px)',
        nodes: [
          {
            type: 'rule',
            selector: ':hover',
            nodes: [
              { type: 'decl', prop: 'background-color', value: 'red-500' }
            ]
          }
        ]
      }
    ]);
  });

  it('applyClassName uses context theme for color', () => {
    const config = {
      theme: { colors: { red: { 500: '#f00' } } }
    };
    const ctx = createContext(config);
    const ast = applyClassName('bg-red-500', ctx);
    expect(ast).toEqual([
      { type: 'decl', prop: 'background-color', value: '#f00' }
    ]);
  });

  it('should produce correct AST for sm:focus:hover:bg-red-500', () => {
    const ctx = createContext({});
    const ast = applyClassName('sm:focus:hover:bg-red-500', ctx);
    expect(ast).toEqual([
      {
        type: 'atrule',
        name: 'media',
        params: '(min-width: 640px)',
        nodes: [
          {
            type: 'rule',
            selector: ':focus',
            nodes: [
              {
                type: 'rule',
                selector: ':hover',
                nodes: [
                  { type: 'decl', prop: 'background-color', value: 'red-500' }
                ]
              }
            ]
          }
        ]
      }
    ]);
  });

  it('should produce correct AST for group-hover:focus:bg-blue-500', () => {
    const ctx = createContext({});
    const ast = applyClassName('group-hover:focus:bg-blue-500', ctx);
    expect(ast).toEqual([
      {
        type: 'rule',
        selector: '.group:hover &',
        nodes: [
          {
            type: 'rule',
            selector: ':focus',
            nodes: [
              { type: 'decl', prop: 'background-color', value: 'blue-500' }
            ]
          }
        ]
      }
    ]);
  });

  it.skip('benchmarks 10,000 classNames parsing/AST in under 1s', () => {
    const ctx = createContext({ theme: { colors: { red: { 500: '#f00' } } } });
    const classNames = [];
    for (let i = 0; i < 10000; i++) {
      // 다양한 modifier/utility 조합을 섞어서 생성
      const mod = i % 2 === 0 ? 'hover:' : 'sm:';
      classNames.push(`${mod}bg-red-500`);
    }
    const t0 = Date.now();
    for (const cn of classNames) {
      applyClassName(cn, ctx);
    }
    const elapsed = Date.now() - t0;
    if (elapsed > 1000) {
      // CI 환경 등에서는 skip 권장, 경고만 출력
      console.warn(`Performance: 10,000 classNames took ${elapsed}ms (>1s)`);
    }
    expect(elapsed).toBeLessThanOrEqual(1000);
  });
}); 