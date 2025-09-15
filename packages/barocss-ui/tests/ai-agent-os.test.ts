/**
 * AI Agent OS Tests
 * AI Agent OS의 핵심 기능 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAIAgentOS, AIAgentOS, createMockAgentCommunicationAdapter } from '../src';
import { SceneConfig } from '../src/types';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public send: (data: string) => void;
  public close: () => void;

  constructor(url: string) {
    this.url = url;
    this.send = vi.fn((data: string) => {
      // Simulate agent response
      setTimeout(() => {
        if (this.onmessage) {
          const message = {
            type: 'success',
            id: 'mock-response-id',
            requestId: JSON.parse(data).id,
            timestamp: Date.now(),
            processingTime: 100,
            status: {
              success: true,
              code: 200,
              message: 'OK'
            },
            data: {
              result: {
                sceneId: 'mock-scene-id',
                html: '<div class="p-4 bg-white rounded-lg">Mock Agent Response</div>',
                actions: [],
                displayType: 'window'
              }
            },
            metadata: {
              version: '1.0.0',
              correlationId: 'mock-correlation-id'
            }
          };
          this.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
        }
      }, 50);
    });
    this.close = vi.fn();

    // Simulate connection immediately
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }
}

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

describe('AI Agent OS', () => {
  let aiAgentOS: AIAgentOS;

  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    
    // Create Mock AI Agent Communication Adapter
    const agentComm = createMockAgentCommunicationAdapter({
      name: 'Test Agent',
      delay: 0,
      errorRate: 0,
      capabilities: ['text-generation', 'ui-creation']
    });
    
    // Create AI Agent OS instance
    aiAgentOS = createAIAgentOS({
      debug: true
    }, agentComm);
  });

  afterEach(async () => {
    // Clean up
    if (aiAgentOS && aiAgentOS.shutdown) {
      await aiAgentOS.shutdown();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await aiAgentOS.initialize();
      expect(aiAgentOS.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Create instance with invalid configuration
      const invalidOS = createAIAgentOS({
        debug: true
      });

      // This should not throw since we removed WebSocket connection logic
      await expect(invalidOS.initialize()).resolves.toBeUndefined();
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should get and set context', () => {
      aiAgentOS.setContext('global.user.id', 'test-user');
      const userId = aiAgentOS.getContext('global.user.id');
      expect(userId).toBe('test-user');
    });

    it('should update context', () => {
      aiAgentOS.setContext('global.user.preferences', { theme: 'light' });
      aiAgentOS.updateContext('global.user.preferences', (current) => ({
        ...current,
        language: 'en'
      }));
      
      const preferences = aiAgentOS.getContext('global.user.preferences');
      expect(preferences).toEqual({ theme: 'light', language: 'en' });
    });

    it('should subscribe to context changes', (done) => {
      const unsubscribe = aiAgentOS.subscribeContext('global.user.id', (value) => {
        if (value === 'new-user') {
          expect(value).toBe('new-user');
          unsubscribe();
          done();
        }
      });

      aiAgentOS.setContext('global.user.id', 'new-user');
    });
  });

  describe('Scene Management', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should create a scene', () => {
      const sceneConfig: SceneConfig = {
        type: 'window',
        title: 'Test Scene',
        component: {
          type: 'div',
          name: 'TestComponent',
          props: { className: 'test-component' }
        }
      };

      const scene = aiAgentOS.createScene(sceneConfig);
      expect(scene).toBeDefined();
      expect(scene.id).toBeDefined();
      expect(scene.title).toBe('Test Scene');
      expect(scene.type).toBe('window');
    });

    it('should update a scene', () => {
      const sceneConfig: SceneConfig = {
        type: 'window',
        title: 'Test Scene',
        component: {
          type: 'div',
          name: 'TestComponent',
          props: { className: 'test-component' }
        }
      };

      const scene = aiAgentOS.createScene(sceneConfig);
      aiAgentOS.updateScene(scene.id, { title: 'Updated Scene' });
      
      const updatedScene = aiAgentOS.getScene(scene.id);
      expect(updatedScene?.title).toBe('Updated Scene');
    });

    it('should remove a scene', () => {
      const sceneConfig: SceneConfig = {
        type: 'window',
        title: 'Test Scene',
        component: {
          type: 'div',
          name: 'TestComponent',
          props: { className: 'test-component' }
        }
      };

      const scene = aiAgentOS.createScene(sceneConfig);
      aiAgentOS.removeScene(scene.id);
      
      const removedScene = aiAgentOS.getScene(scene.id);
      expect(removedScene).toBeNull();
    });

    it('should get all scenes', () => {
      const scene1 = aiAgentOS.createScene({
        type: 'window',
        title: 'Scene 1',
        component: { type: 'div', name: 'Component1', props: {} }
      });

      const scene2 = aiAgentOS.createScene({
        type: 'modal',
        title: 'Scene 2',
        component: { type: 'div', name: 'Component2', props: {} }
      });

      const allScenes = aiAgentOS.getAllScenes();
      expect(allScenes).toHaveLength(2);
      expect(allScenes.map(s => s.id)).toContain(scene1.id);
      expect(allScenes.map(s => s.id)).toContain(scene2.id);
    });

    it('should set and get active scene', () => {
      const scene = aiAgentOS.createScene({
        type: 'window',
        title: 'Test Scene',
        component: { type: 'div', name: 'TestComponent', props: {} }
      });

      aiAgentOS.setActiveScene(scene.id);
      const activeScene = aiAgentOS.getActiveScene();
      expect(activeScene?.id).toBe(scene.id);
    });

    it('should validate scene consistency', () => {
      const parentScene = aiAgentOS.createScene({
        type: 'window',
        title: 'Parent Scene',
        component: { type: 'div', name: 'ParentComponent', props: {} }
      });

      const childScene = aiAgentOS.createScene({
        type: 'popover',
        title: 'Child Scene',
        component: { type: 'div', name: 'ChildComponent', props: {} },
        parentId: parentScene.id
      });

      const validation = aiAgentOS.validateSceneConsistency();
      expect(validation.ok).toBe(true);
      expect(validation.summary.totalScenes).toBe(2);
      expect(validation.summary.rootScenes).toBe(1);
    });
  });

  describe('Agent Communication', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should send request to agent', async () => {
      const request = {
        id: 'test-request',
        type: 'create_scene' as const,
        timestamp: Date.now(),
        priority: 'normal' as const,
        source: 'user' as const,
        context: aiAgentOS.getCurrentContext(),
        metadata: {
          version: '1.0.0',
          correlationId: 'test-correlation',
          parentRequestId: null,
          tags: ['test']
        },
        payload: {
          sceneType: 'window' as const,
          title: 'Test Scene',
          component: {
            type: 'div',
            name: 'TestComponent',
            props: { className: 'test' }
          }
        }
      };

      const response = await aiAgentOS.sendRequest(request);
      expect(response).toBeDefined();
      expect(response.status.success).toBe(true);
    });

    it('should handle communication errors', async () => {
      // Create instance with error-throwing communication adapter
      const errorComm = createMockAgentCommunicationAdapter({
        name: 'Error Agent',
        errorRate: 1.0 // 100% error rate
      });

      const invalidOS = createAIAgentOS({
        debug: true
      }, errorComm);

      await invalidOS.initialize();

      const request = {
        id: 'test-request',
        type: 'create_scene' as const,
        timestamp: Date.now(),
        priority: 'normal' as const,
        source: 'user' as const,
        context: invalidOS.getCurrentContext(),
        metadata: {
          version: '1.0.0',
          correlationId: 'test-correlation',
          parentRequestId: null,
          tags: ['test']
        },
        payload: {
          sceneType: 'window' as const,
          title: 'Test Scene',
          component: {
            type: 'div',
            name: 'TestComponent',
            props: { className: 'test' }
          }
        }
      };

      await expect(invalidOS.sendRequest(request)).rejects.toThrow();
    });
  });

  describe('System Events', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should emit and handle system events', (done) => {
      const unsubscribe = aiAgentOS.subscribeToEvents((event) => {
        expect(event.type).toBe('context_change');
        expect(event.data.path).toBe('global.user.id');
        expect(event.data.newValue).toBe('test-user');
        unsubscribe();
        done();
      });

      aiAgentOS.setContext('global.user.id', 'test-user');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should provide system statistics', () => {
      const stats = aiAgentOS.getStats();
      expect(stats).toBeDefined();
      expect(stats.isReady).toBe(true);
      expect(stats.agentConnection).toBeDefined();
      expect(stats.agentConnection.isConnected).toBeDefined();
      expect(stats.contextDebugInfo).toBeDefined();
      expect(stats.sceneStats).toBeDefined();
      expect(stats.renderStats).toBeDefined();
      expect(stats.actionStats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await aiAgentOS.initialize();
    });

    it('should handle scene creation errors', () => {
      expect(() => {
        aiAgentOS.createScene({
          type: 'window',
          title: '', // Invalid: empty title
          component: {
            type: 'div',
            name: 'TestComponent',
            props: {}
          }
        });
      }).toThrow();
    });

    it('should handle scene update errors', () => {
      expect(() => {
        aiAgentOS.updateScene('non-existent-scene', { title: 'Updated' });
      }).toThrow();
    });

    it('should handle scene removal errors', () => {
      expect(() => {
        aiAgentOS.removeScene('non-existent-scene');
      }).toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly on shutdown', async () => {
      await aiAgentOS.initialize();
      
      // Create some scenes
      const scene1 = aiAgentOS.createScene({
        type: 'window',
        title: 'Scene 1',
        component: { type: 'div', name: 'Component1', props: {} }
      });

      const scene2 = aiAgentOS.createScene({
        type: 'modal',
        title: 'Scene 2',
        component: { type: 'div', name: 'Component2', props: {} }
      });

      // Shutdown
      await aiAgentOS.shutdown();

      // Verify cleanup
      expect(aiAgentOS.isReady()).toBe(false);
      expect(aiAgentOS.getAllScenes()).toHaveLength(0);
    });
  });
});
