import { createContext } from "../../src/core/context";

// 공통 테스트 컨텍스트 생성
export const createTestContext = (overrides = {}) => {
  return createContext({
    theme: {
      colors: { red: { 500: "#f00" } },
      breakpoints: {
        sm: "(min-width: 640px)",
        md: "(min-width: 768px)",
        lg: "(min-width: 1024px)",
        xl: "(min-width: 1280px)",
        "2xl": "(min-width: 1536px)",
        // 사용자 정의 breakpoint
        tablet: "(min-width: 768px)",
        desktop: "(min-width: 1024px)",
        wide: "(min-width: 1440px)",
      },
      ...overrides,
    },
  });
};

// 기본 테스트 컨텍스트
export const ctx = createTestContext(); 