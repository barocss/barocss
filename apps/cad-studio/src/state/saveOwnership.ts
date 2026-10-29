// Studio-private Save receipt decisions. Document dispatch ownership is independent of evaluation ownership.
export interface DocumentSaveOwner<D extends object> { token: object; doc: D; name: string }
export function currentDocumentSave<D extends object>(owner: DocumentSaveOwner<D>, token: object, doc: D, name: string): boolean {
  return owner.token === token && owner.doc === doc && owner.name === name;
}
/** A delayed older success must not move this session's file tag backwards. */
export function acceptSaveReceipt(owner: { success: number }, order: number): boolean {
  if (order < owner.success) return false;
  owner.success = order;
  return true;
}
