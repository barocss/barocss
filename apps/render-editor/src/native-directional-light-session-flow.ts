import {parseRenderNativeDirectionalLightDocument, serializeRenderNativeDirectionalLightDocument} from '@barocss/render-editor';
import type {RenderNativeDirectionalLightDocumentV1} from '@barocss/render-editor';
import {createNativeDirectionalLightController} from './native-directional-light-controller.js';

function check(value: unknown, message: string): asserts value {if (!value) throw Error(message);}
/** Source/emitted headless consumer flow. A controlled Viewer in tests is not a GPU/pixel acceptance witness. */
export async function runNativeDirectionalLightSessionFlow(canvas: HTMLCanvasElement, initial: RenderNativeDirectionalLightDocumentV1) {
  const controller = createNativeDirectionalLightController();
  try {
    const session = await controller.mount(canvas, initial, {width: 32, height: 32});
    check(session, 'Session did not mount');
    const apply = async (ambientStrength: number) => {
      const before = session.getSnapshot();
      session.setDraftText(serializeRenderNativeDirectionalLightDocument({...before.accepted,
        lights: {...before.accepted.lights, ambientStrength}}), before.version);
      await session.commitPrepared(session.prepareDraft(session.getSnapshot().version));
    };
    await apply(.2); await apply(.4);
    const undo = session.prepareUndo(session.getSnapshot().version); check(undo, 'Undo absent'); await session.commitPrepared(undo);
    check(session.getSnapshot().accepted.lights.ambientStrength === .2, 'Undo content');
    const redo = session.prepareRedo(session.getSnapshot().version); check(redo, 'Redo absent'); await session.commitPrepared(redo);
    check(session.getSnapshot().accepted.lights.ambientStrength === .4, 'Redo content');
    const saved = session.getSavePayload(); session.markSaved(saved);
    session.setDraftText('{invalid draft', session.getSnapshot().version);
    check(session.getSavePayload().text === saved.text && !session.getSnapshot().unsaved && session.getSnapshot().dirty, 'Accepted Save/draft split');
    const parsed = parseRenderNativeDirectionalLightDocument(saved.text);
    await session.commitPrepared(session.prepareOpen(serializeRenderNativeDirectionalLightDocument(parsed), session.getSnapshot().version));
    check(!session.getSnapshot().canUndo && !session.getSnapshot().dirty && !session.getSnapshot().unsaved, 'Open state');
    await apply(.6);
    const second = session.getSavePayload(); session.markSaved(second);
    const fresh = parseRenderNativeDirectionalLightDocument(second.text);
    check(fresh.lights.ambientStrength === .6 && fresh.revision === initial.revision + 5, 'Fresh second Save');
    check(JSON.stringify(fresh.nativeDocument) === JSON.stringify(initial.nativeDocument), 'Native authority changed');
    return Object.freeze({scope: 'headless transaction consumer; no pixel or physical file claim', revision: fresh.revision,
      first: saved.text, second: second.text, status: session.getStatus().state});
  } finally {controller.dispose();}
}
