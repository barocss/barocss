import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS align/justify/place 계열 유틸리티 완전 대응
// items-*, content-*, self-*, justify-*, justify-items, justify-self, align-items, align-content, align-self, place-content, place-items, place-self

const alignItemsMap: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  "end-safe": "safe flex-end",
  center: "center",
  "center-safe": "safe center",
  baseline: "baseline",
  "baseline-last": "last baseline",
  stretch: "stretch",
};

const alignContentMap: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
  stretch: "stretch",
  normal: "normal",
};

const alignSelfMap: Record<string, string> = {
  auto: "auto",
  start: "flex-start",
  end: "flex-end",
  center: "center",
  baseline: "baseline",
  "baseline-last": "last baseline",
  stretch: "stretch",
};

const justifyContentMap: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
  normal: "normal",
  stretch: "stretch",
};

const justifyItemsMap: Record<string, string> = {
  start: "start",
  end: "end",
  center: "center",
  stretch: "stretch",
};

const justifySelfMap: Record<string, string> = {
  auto: "auto",
  start: "start",
  end: "end",
  center: "center",
  stretch: "stretch",
};

const placeContentMap: Record<string, string> = {
  start: "start",
  end: "end",
  center: "center",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
  stretch: "stretch",
  normal: "normal",
};

const placeItemsMap: Record<string, string> = {
  start: "start",
  end: "end",
  center: "center",
  stretch: "stretch",
};

const placeSelfMap: Record<string, string> = {
  auto: "auto",
  start: "start",
  end: "end",
  center: "center",
  stretch: "stretch",
};

export const items = (utility: ParsedClassToken) => ({
  alignItems: alignItemsMap[utility.value] ? alignItemsMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const content = (utility: ParsedClassToken) => ({
  alignContent: alignContentMap[utility.value] ? alignContentMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const self = (utility: ParsedClassToken) => ({
  alignSelf: alignSelfMap[utility.value] ? alignSelfMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const justify = (utility: ParsedClassToken) => ({
  justifyContent: justifyContentMap[utility.value] ? justifyContentMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const justifyItems = (utility: ParsedClassToken) => ({
  justifyItems: justifyItemsMap[utility.value] ? justifyItemsMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const justifySelf = (utility: ParsedClassToken) => ({
  justifySelf: justifySelfMap[utility.value] ? justifySelfMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const alignItems = (utility: ParsedClassToken) => ({
  alignItems: alignItemsMap[utility.value] ? alignItemsMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const alignContent = (utility: ParsedClassToken) => ({
  alignContent: alignContentMap[utility.value] ? alignContentMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const alignSelf = (utility: ParsedClassToken) => ({
  alignSelf: alignSelfMap[utility.value] ? alignSelfMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const placeContent = (utility: ParsedClassToken) => ({
  placeContent: placeContentMap[utility.value] ? placeContentMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const placeItems = (utility: ParsedClassToken) => ({
  placeItems: placeItemsMap[utility.value] ? placeItemsMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
});

export const placeSelf = (utility: ParsedClassToken) => ({
  placeSelf: placeSelfMap[utility.value] ? placeSelfMap[utility.value] + (utility.important ? " !important" : "") : utility.value + (utility.important ? " !important" : "")
}); 