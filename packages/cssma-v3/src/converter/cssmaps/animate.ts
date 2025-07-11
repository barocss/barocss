import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 animation utilities
 * https://tailwindcss.com/docs/animation
 *
 * Supported classes:
 * - animate-none
 * - animate-spin, animate-ping, animate-pulse, animate-bounce, ...
 * - animate-(--custom)
 * - animate-[arbitrary]
 * - !important modifier
 *
 * ---
 *
 * [Keyframes 설명]
 * - Tailwind의 animation 유틸리티는 실제로는 animation 속성에 keyframes 이름, duration, timing-function, 반복 등 전체 값을 할당합니다.
 *   예: 'spin 1s linear infinite' (animation: <keyframes> <duration> <timing-function> <iteration-count>)
 * - keyframes 정의는 theme.animation에서 참조하는 keyframes 이름과 연결됩니다.
 *   예: theme.animation.spin = 'spin 1s linear infinite' → @keyframes spin { ... } 도 theme.keyframes.spin에 정의 가능
 * - cssma-v3에서는 theme.animation에서 animation 값을, theme.keyframes에서 keyframes 정의를 각각 관리할 수 있습니다.
 * - 이 유틸리티는 animation 속성만 반환하며, keyframes 자체의 생성/적용은 별도의 스타일 생성기 또는 런타임에서 처리해야 합니다.
 *
 * [사용자 커스터마이즈]
 * - 사용자 테마에서 animation과 keyframes를 모두 정의하면, animate-spin 등에서 자동으로 연결됩니다.
 * - 예시:
 *   theme: {
 *     animation: { spin: 'spin 1s linear infinite' },
 *     keyframes: { spin: { to: { transform: 'rotate(360deg)' } } }
 *   }
 *
 * [참고]
 * - https://tailwindcss.com/docs/animation
 */

const animationMap: Record<string, string> = {
  'none': 'none',
};

export function animate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // animate-(--custom) → animation: var(--custom)
  if (utility.customProperty && utility.value) {
    return { animation: `var(${utility.value})` + important };
  }

  // animate-[arbitrary] → animation: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    return { animation: utility.arbitraryValue + important };
  }

  // Standard classes
  if (utility.value && animationMap[utility.value]) {
    return { animation: animationMap[utility.value] + important };
  }

  // Theme lookup (spin, ping, pulse, bounce, custom)
  if (utility.value) {
    const themeVal = ctx.theme?.('animation', utility.value);
    if (themeVal !== undefined) {
      return { animation: themeVal + important };
    }
    // fallback: use as raw value
    return { animation: utility.value + important };
  }

  return undefined;
} 