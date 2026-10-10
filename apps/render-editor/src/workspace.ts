import type { RenderSceneDocument } from '@barocss/render-editor';
import { fixtureDocuments } from './fixtures';

export interface WorkspaceProject {
  key: string;
  document: RenderSceneDocument;
  origin: 'example' | 'local' | 'file';
  savedRevision: number | null;
}

export function createWorkspace(): WorkspaceProject[] {
  return fixtureDocuments.map((document) => ({ key: document.documentId, document, origin: 'example', savedRevision: document.revision }));
}

export function projectRoute(key: string): string { return `#/workspace/${encodeURIComponent(key)}`; }

export function readProjectRoute(): string | null {
  const match = /^#\/workspace\/([^/]+)$/.exec(window.location.hash);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function replaceProjectRoute(key: string): void {
  window.history.replaceState(null, '', projectRoute(key));
}
