
export interface ComponentStyles {
  base?: string;
  variants?: Record<string, string>;
}

export interface TaildownConfig {
  components?: Record<string, ComponentStyles>;
}
