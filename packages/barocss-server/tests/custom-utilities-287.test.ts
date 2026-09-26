import { describe, expect, it } from 'vitest';
import { ServerRuntime } from '../src/index';

// #287: ServerRuntime passes config.utilities to the kit context; its #272 cache treats them like any class.
const utilities = { 'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' } };

describe('#287 server custom utilities', () => {
  it('includes custom utilities in server output', () => {
    const server = new ServerRuntime({ utilities });
    const css = server.generateCssForHtml('<main class="max-w-app md:max-w-app">x</main>');
    expect(css).toContain('.max-w-app');
    expect(css).toContain('max-width: 72rem');
    expect(css).toContain('md\\:max-w-app');
    expect(server.generateCss('max-w-app')).toBe(server.generateCss('max-w-app'));
  });
  it('drops them after setConfig without the option', () => {
    const server = new ServerRuntime({ utilities });
    expect(server.generateCss('max-w-app')).toContain('72rem');
    server.setConfig({});
    expect(server.generateCss('max-w-app')).not.toContain('72rem');
  });
});
