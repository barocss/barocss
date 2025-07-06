
import { describe, it, expect } from 'vitest';
import { taildown } from '../src';
import type { TaildownConfig } from '../src/types';

const testConfig: TaildownConfig = {
  components: {
    title: {
      base: 'text-2xl font-bold',
    },
    card: {
      base: 'p-4 bg-white rounded-lg',
    },
    'card-hover': {
      base: 'shadow-lg',
    },
  },
};

describe('taildown', () => {
  it('should apply a basic component', async () => {
    const markdown = `# Hello World {: apply="title" }`;
    const html = await taildown(markdown, testConfig);
    expect(html).toContain('<h1 class="text-2xl font-bold">Hello World</h1>');
  });

  it('should apply a hover variant', async () => {
    const markdown = `<div>A card</div> {: apply="card" hover:apply="card-hover" }`;
    const html = await taildown(markdown, testConfig);
    expect(html).toContain('<div class="p-4 bg-white rounded-lg hover:shadow-lg">A card</div>');
  });

  it('should merge with existing classes', async () => {
    const markdown = `# Title {: apply="title" class="mt-4" }`;
    const html = await taildown(markdown, testConfig);
    const element = html.match(/<h1 class="(.*?)">/);
    const classes = element ? element[1].split(' ') : [];
    expect(classes).toContain('text-2xl');
    expect(classes).toContain('font-bold');
    expect(classes).toContain('mt-4');
  });
});
