// Studio-private bridge between project requests and the App document owner.
export type OpenScope = object;
export interface OpenIntentBridge {
  onOpenIntent?(): OpenScope;
  currentOpenScope?(): OpenScope;
  isOpenCurrent?(scope: OpenScope): boolean;
}
