import { describe, it, expect } from 'vitest';
import { astToCss } from '../src/core/astToCss';
import { decl, rule, atRule, AstNode } from '../src/core/ast';
import { parseClassName } from '../src/core/parser';

describe('astToCss', () => {
  it('converts nested media and hover rules', () => {
    const ast = [
      atRule('media', '(min-width: 640px)', [
        rule(':hover', [
          decl('background-color', '#f00')
        ])
      ])
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
      decl('--my-var', '42'),
      decl('color', 'red !important')
    ];
    expect(astToCss(ast)).toBe(
`--my-var: 42;
color: red !important;`
    );
  });

  it('deduplicates decls (last wins)', () => {
    const ast = [
      decl('color', 'red'),
      decl('color', 'blue')
    ];
    expect(astToCss(ast, 'color-blue')).toBe('color: blue;');
  });

  it('prepends baseSelector to :hover', () => {
    const ast = [
      rule(':hover', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'my-btn')).toBe(
`.my-btn:hover {
  background-color: #f00;
}`
    );
  });

  it('prepends baseSelector to nested media/hover', () => {
    const ast = [
      atRule('media', '(min-width: 640px)', [
        rule(':hover', [
          decl('background-color', '#f00')
        ])
      ])
    ];
    expect(astToCss(ast, 'my-btn')).toBe(
`@media (min-width: 640px) {
  .my-btn:hover {
    background-color: #f00;
  }
}`
    );
  });

  it('minifies output when minify option is true', () => {
    const ast = [
      rule(':hover', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'my-btn', { minify: true })).toBe('.my-btn:hover{background-color: #f00;}');
  });

  it('minifies nested media/hover', () => {
    const ast = [
      atRule('media', '(min-width: 640px)', [
        rule(':hover', [
          decl('background-color', '#f00')
        ])
      ])
    ];
    expect(astToCss(ast, 'my-btn', { minify: true })).toBe('@media (min-width: 640px){.my-btn:hover{background-color: #f00;}}');
  });

  it('converts parseClassName result for hover:bg-red-500', () => {
    const parsed = parseClassName('hover:bg-red-500');
    const ast = [
      rule('&:hover', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'hover:bg-red-500')).toBe(
`.hover\\:bg-red-500:hover {
  background-color: #f00;
}`
    );
  });

  it('converts parseClassName result for group-hover:sm:bg-[red]', () => {
    const ast = [
      atRule('media', '(min-width: 640px)', [
        rule('.group-hover:hover', [
          decl('background-color', 'red')
        ])
      ])
    ];
    expect(astToCss(ast, 'group-hover:sm:bg-[red]')).toBe(
`@media (min-width: 640px) {
  .group-hover\\:sm\\:bg-\\[red\\].group-hover:hover {
    background-color: red;
  }
}`
    );
  });

  it('escapes colon in baseSelector', () => {
    const ast = [
      rule('&:hover', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'sm:hover:bg-red-500')).toBe(
`.sm\\:hover\\:bg-red-500:hover {
  background-color: #f00;
}`
    );
  });

  it('escapes multiple colons and brackets in baseSelector', () => {
    const ast = [
      rule(':focus', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'md:group-hover:bg-[red]')).toBe(
`.md\\:group-hover\\:bg-\\[red\\]:focus {
  background-color: #f00;
}`
    );
  });

  it('escapes and minifies', () => {
    const ast = [
      rule(':hover', [
        decl('background-color', '#f00')
      ])
    ];
    expect(astToCss(ast, 'sm:hover:bg-red-500', { minify: true })).toBe('.sm\\:hover\\:bg-red-500:hover{background-color: #f00;}');
  });

  it('handles style-rule node with baseSelector', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '&[data-active]::before',
        nodes: [
          { type: 'decl', prop: 'content', value: '"!"' },
          { type: 'decl', prop: 'color', value: 'red' }
        ]
      }
    ];
    expect(astToCss(ast, 'alert:before')).toBe(
`&[data-active]::before {
  content: "!";
  color: red;
}`
    );
  });
});

describe('style-rule selector & replacement', () => {
  it('replaces & at the start', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '&[data-active]::before',
        nodes: [
          { type: 'decl', prop: 'content', value: '"!"' }
        ]
      }
    ];
    expect(astToCss(ast, 'alert:before')).toBe(
`&[data-active]::before {
  content: "!";
}`
    );
  });
  it('replaces & at the end', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '[data-active] &',
        nodes: [
          { type: 'decl', prop: 'color', value: 'red' }
        ]
      }
    ];
    expect(astToCss(ast, 'alert:after')).toBe(
`[data-active] & {
  color: red;
}`
    );
  });
  it('replaces & in the middle', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '[data-x] &::before',
        nodes: [
          { type: 'decl', prop: 'color', value: 'blue' }
        ]
      }
    ];
    expect(astToCss(ast, 'alert:icon')).toBe(
`[data-x] &::before {
  color: blue;
}`
    );
  });
  it('replaces multiple & in selector', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '& + &',
        nodes: [
          { type: 'decl', prop: 'margin-left', value: '8px' }
        ]
      }
    ];
    expect(astToCss(ast, 'alert')).toBe(
`& + & {
  margin-left: 8px;
}`
    );
  });
  it('does not replace & if baseSelector is not given', () => {
    const ast: AstNode[] = [
      {
        type: 'style-rule',
        selector: '&[data-active]::before',
        nodes: [
          { type: 'decl', prop: 'content', value: '"!"' }
        ]
      }
    ];
    expect(astToCss(ast)).toBe(
`&[data-active]::before {
  content: "!";
}`
    );
  });
}); 