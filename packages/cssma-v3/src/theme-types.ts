// Tailwind v4 구조를 참고한 cssma-v3의 theme/config 타입 정의

import type { ColorPalette } from "./config/color-palette";

export interface CssmaTheme {
  /** 색상 팔레트 (ex: red-500, blue-200 등) */
  colors?: ColorPalette;
  /** 폰트 패밀리 (ex: sans, serif, mono, ... ) */
  fontFamily?: Record<string, string>;
  /** 폰트 굵기 (ex: thin, bold, extrabold, ... ) */
  fontWeight?: Record<string, string | number>;
  /** 폰트 사이즈 (ex: xs, sm, base, lg, ... ) */
  fontSize?: Record<string, string>;
  /** 타이포그래피 */
  letterSpacing?: Record<string, string>;
  lineHeight?: Record<string, string>;
  /** 브레이크포인트 (ex: sm, md, lg, xl, 2xl, ... ) */
  screens?: Record<string, string>;
  container?: Record<string, string>;
  /** spacing/sizing */
  spacing?: Record<string, string>;
  width?: Record<string, string>;
  minWidth?: Record<string, string>;
  maxWidth?: Record<string, string>;
  height?: Record<string, string>;
  minHeight?: Record<string, string>;
  maxHeight?: Record<string, string>;
  /** border */
  borderRadius?: Record<string, string>;
  borderWidth?: Record<string, string>;
  borderColor?: Record<string, string>;
  borderStyle?: Record<string, string>;
  /** box-shadow (ex: sm, md, lg, ... ) */
  boxShadow?: Record<string, string>;
  /** inset box-shadow */
  insetShadow?: Record<string, string>;
  /** drop-shadow (filter) */
  dropShadow?: Record<string, string>;
  opacity?: Record<string, string>;
  /** blur (filter) */
  blur?: Record<string, string>;
  /** transform/animation */
  scale?: Record<string, string>;
  rotate?: Record<string, string>;
  skew?: Record<string, string>;
  translate?: Record<string, string>;
  /** perspective (3D) */
  perspective?: Record<string, string>;
  /** aspect-ratio (ex: video, square, ...) */
  aspect?: Record<string, string>;
  /** transition timing function */
  ease?: Record<string, string>;
  /** animation (ex: spin, ping, bounce, ...) */
  animation?: Record<string, string>;
  /** 기타 네임스페이스 */
  outline?: Record<string, string>;
  mask?: Record<string, string>;
  fill?: Record<string, string>;
  stroke?: Record<string, string>;
  accent?: Record<string, string>;
  caret?: Record<string, string>;
  zIndex?: Record<string, string | number>;
  /** catch-all for custom/미지원 네임스페이스 */
  [namespace: string]: any;
}

export interface CssmaPreset {
  name: string;
  theme: CssmaTheme;
  extends?: string;
  description?: string;
  [key: string]: any;
}

export type CssmaPlugin = (api: CssmaPluginApi) => void;

export interface CssmaPluginApi {
  addUtilities: (utils: Record<string, any>) => void;
  addComponents: (comps: Record<string, any>) => void;
  addBase: (base: Record<string, any>) => void;
  addVariant: (name: string, fn: Function) => void;
  theme: (path: string, ...rest: (string|number)[]) => any;
  config: (path: string, defaultValue?: any) => any;
}

export interface CssmaConfig {
  mode?: "jit" | "aot";
  prefix?: string;
  corePlugins?: string[];
  presets?: CssmaPreset[];
  theme?: CssmaTheme;
  plugins?: CssmaPlugin[];
  [key: string]: any;
}

export interface CssmaContext {
  hasPreset: (category: string, preset: string) => boolean;
  theme: (...path: (string|number)[]) => any;
  config: (...path: (string|number)[]) => any;
  plugins: CssmaPlugin[];
} 