import { describe, it, expect } from 'vitest';
import { Agent, type AIProvider, type ModelIdentifier } from '../src/index';

class EchoProvider implements AIProvider {
  name = 'openai';
  async sendPrompt(prompt: string, _model: ModelIdentifier): Promise<string> {
    return `echo:${prompt}`;
  }
}

describe('Agent', () => {
  it('runs with a provider', async () => {
    const agent = new Agent({
      name: 'test',
      aiProviders: [new EchoProvider()],
      defaultModel: { provider: 'openai', model: 'gpt-4o-mini' }
    });
    const res = await agent.run('hello');
    expect(res).toBe('echo:hello');
  });
});


