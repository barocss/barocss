import type { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 display converter (prefix 기반)
 * - { prefix: 'block', value: '' } → display: 'block'
 * - { prefix: 'inline', value: '' } → display: 'inline'
 * - ...
 * - hidden, sr-only, not-sr-only 등도 prefix로 판별
 * - !important 지원
 */
const displayValues: Record<string, string> = {
  inline: "inline",
  block: "block",
  'inline-block': "inline-block",
  'flow-root': "flow-root",
  flex: "flex",
  'inline-flex': "inline-flex",
  grid: "grid",
  'inline-grid': "inline-grid",
  contents: "contents",
  table: "table",
  'inline-table': "inline-table",
  'table-caption': "table-caption",
  'table-cell': "table-cell",
  'table-column': "table-column",
  'table-column-group': "table-column-group",
  'table-footer-group': "table-footer-group",
  'table-header-group': "table-header-group",
  'table-row-group': "table-row-group",
  'table-row': "table-row",
  'list-item': "list-item",
  hidden: "none",
};

// sr-only, not-sr-only 스타일 객체
const srOnly = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
};
const notSrOnly = {
  position: "static",
  width: "auto",
  height: "auto",
  padding: "0",
  margin: "0",
  overflow: "visible",
  clip: "auto",
  whiteSpace: "normal",
};

export const display = (utility: ParsedClassToken) => {
  const important = utility.important ? " !important" : "";
  // sr-only, not-sr-only
  if (utility.prefix === "sr-only") return { ...srOnly };
  if (utility.prefix === "not-sr-only") return { ...notSrOnly };
  // display 값
  if (displayValues[utility.prefix] !== undefined) {
    return { display: displayValues[utility.prefix] + important };
  }
  return undefined;
}; 