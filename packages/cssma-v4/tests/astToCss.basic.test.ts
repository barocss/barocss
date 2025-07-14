import { describe, it, expect } from 'vitest';
import { astToCss } from '../src/core/astToCss';

describe('astToCss', () => {
  it('converts nested media and hover rules', () => {
    const ast = [
      {
        type: 'atrule',
        name: 'media',
        params: '(min-width: 640px)',
        nodes: [
          {
            type: 'rule',
            selector: ':hover',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' }
            ]
          }
        ]
      }
    ];
    expect(astToCss(ast)).toBe(
`@media (min-width: 640px) {
  :hover {
    background-color: #f00;
  }
}`
    );
  });

  it('handles custom property and !important', () => {
    const ast = [
      { type: 'decl', prop: '--my-var', value: '42' },
      { type: 'decl', prop: 'color', value: 'red', important: true }
    ];
    expect(astToCss(ast)).toBe(
`--my-var: 42;
color: red !important;`
    );
  });

  it('deduplicates decls (last wins)', () => {
    const ast = [
      { type: 'decl', prop: 'color', value: 'red' },
      { type: 'decl', prop: 'color', value: 'blue' }
    ];
    expect(astToCss(ast)).toBe('color: blue;');
  });
}); 