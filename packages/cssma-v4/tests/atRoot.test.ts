import { describe, it, expect } from 'vitest';
import { generateCss } from '../src/core/engine';
import { createContext } from '../src/core/context';
import { defaultTheme } from '../src/theme';
import { decl, atRoot } from '../src/core/ast';

describe('atRoot Collection', () => {
  const ctx = createContext({ theme: defaultTheme });

  it('should collect atRoot nodes from multiple classes', () => {
    // atRoot를 포함하는 클래스들을 테스트
    const css = generateCss('bg-linear-to-r bg-linear-to-l', ctx);
    
    // 로그에서 atRoot 노드들이 수집되는지 확인
    console.log('Generated CSS:', css);
  });

  it('should handle atRoot nodes in AST', () => {
    // 직접 atRoot 노드를 포함한 AST 생성
    const astWithAtRoot = [
      atRoot([
        decl('--tw-gradient-position', 'to right'),
        decl('--tw-gradient-stops', 'var(--tw-gradient-from), var(--tw-gradient-to)')
      ]),
      decl('background-image', 'linear-gradient(var(--tw-gradient-stops))')
    ];
    
    console.log('AST with atRoot:', astWithAtRoot);
  });
}); 