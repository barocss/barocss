export class SceneHistory {
  #renderer;
  #entries;
  #index = 0;
  #limit;

  constructor(renderer, initialScene, limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new RangeError('history limit must be 1..50');
    }
    renderer.updateScene(initialScene);
    this.#renderer = renderer;
    this.#entries = [structuredClone(initialScene)];
    this.#limit = limit;
    renderer.render();
  }

  get scene() { return structuredClone(this.#entries[this.#index]); }
  get canUndo() { return this.#index > 0; }
  get canRedo() { return this.#index + 1 < this.#entries.length; }
  get position() { return this.#index; }
  get length() { return this.#entries.length; }

  #candidate(edit) {
    if (typeof edit !== 'function') throw new TypeError('scene command must be a function');
    const candidate = this.scene;
    edit(candidate);
    this.#renderer.updateScene(candidate);
    return candidate;
  }

  preview(edit) {
    const candidate = this.#candidate(edit);
    this.#renderer.render();
    return structuredClone(candidate);
  }

  commit(edit) {
    const candidate = this.#candidate(edit);
    const entries = this.#entries.slice(0, this.#index + 1);
    entries.push(structuredClone(candidate));
    if (entries.length > this.#limit) entries.shift();
    this.#entries = entries;
    this.#index = entries.length - 1;
    this.#renderer.render();
    return this.scene;
  }

  restore() {
    const scene = this.scene;
    this.#renderer.updateScene(scene);
    this.#renderer.render();
    return scene;
  }

  undo() {
    if (!this.canUndo) return this.scene;
    const scene = this.#entries[this.#index - 1];
    this.#renderer.updateScene(scene);
    this.#index--;
    this.#renderer.render();
    return this.scene;
  }

  redo() {
    if (!this.canRedo) return this.scene;
    const scene = this.#entries[this.#index + 1];
    this.#renderer.updateScene(scene);
    this.#index++;
    this.#renderer.render();
    return this.scene;
  }

  replace(value) {
    this.#renderer.updateScene(value);
    this.#entries = [structuredClone(value)];
    this.#index = 0;
    this.#renderer.render();
    return this.scene;
  }

  attachRenderer(renderer) {
    renderer.updateScene(this.scene);
    renderer.render();
    this.#renderer = renderer;
  }
}
