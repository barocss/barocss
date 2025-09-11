import { UIRuntime, AIService, AIContext, AIResponse } from '@barocss/ui';

// Mock AI Service for testing
class MockAIService implements AIService {
  async generateResponse(input: string, context: AIContext): Promise<AIResponse> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Generate different UI based on input
    const responses = {
      'login': {
        html: `
          <!-- Modal Content Container -->
          <div style="background-color: white; border-radius: 0.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%;">
            
            <!-- Modal Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; color: #111827;">Login</h3>
              <button style="color: #9ca3af; padding: 0.25rem; border-radius: 0.375rem; background: none; border: none; cursor: pointer;" data-action="close">
                <svg style="width: 1.5rem; height: 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- Modal Content -->
            <div style="padding: 1.5rem;">
              <form style="display: flex; flex-direction: column; gap: 1rem;" data-action="submit">
                <div>
                  <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem;">Email</label>
                  <input type="email" name="email" required
                         style="width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; outline: none;"
                         placeholder="Enter your email">
                </div>
                
                <div>
                  <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem;">Password</label>
                  <input type="password" name="password" required
                         style="width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; outline: none;"
                         placeholder="Enter your password">
                </div>
                
                <button type="submit" 
                        style="width: 100%; background-color: #2563eb; color: white; font-weight: 500; padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; cursor: pointer;">
                  Login
                </button>
              </form>
            </div>
          </div>
        `,
        display: { type: 'modal', size: 'medium', position: 'center', priority: 'high', backdrop: 'blur' },
        context: { id: 'login-form-' + Date.now(), parent: null, purpose: 'user_authentication', workflow: 'user_onboarding' },
        interactions: {
          'submit': {
            action: 'validate_and_submit',
            dataExtraction: { email: 'input[name="email"]', password: 'input[name="password"]' },
            nextPrompt: 'Please verify user information and proceed to the next step'
          },
          'close': {
            action: 'close_modal',
            nextPrompt: 'Please close the window and clean up'
          }
        },
        effects: { entrance: 'fadeIn', duration: 300 },
        workflow: { currentStep: 'login_form', nextSteps: ['validation', 'dashboard_redirect'], completionCriteria: ['email', 'password'], dataCollection: {} }
      },
      'dashboard': {
        html: `
          <div class="fixed top-4 right-4 w-96 max-w-full bg-white rounded-lg shadow-2xl border border-gray-200 z-40 transform transition-all duration-300 ease-out" 
               data-positioning-strategy="smart"
               data-z-index="9998"
               data-window-data='{"type": "dashboard", "user": "test@example.com"}'>
            
            <!-- Window Title Bar -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-4 rounded-t-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-blue-800">Dashboard</h3>
                  <div class="text-sm text-blue-600">test@example.com</div>
                </div>
                <button class="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-md hover:bg-gray-100" data-action="close">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Window Content -->
            <div class="p-6 bg-gray-50">
              <!-- Stats Grid -->
              <div class="grid grid-cols-1 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="font-semibold text-gray-800 mb-1">Total Projects</h4>
                      <p class="text-2xl font-bold text-blue-600">12</p>
                    </div>
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="font-semibold text-gray-800 mb-1">Completed Tasks</h4>
                      <p class="text-2xl font-bold text-green-600">8</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="font-semibold text-gray-800 mb-1">In Progress</h4>
                      <p class="text-2xl font-bold text-yellow-600">4</p>
                    </div>
                    <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div class="space-y-3">
                <button class="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-sm hover:shadow-md" data-action="new_project">
                  <div class="flex items-center justify-center space-x-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Create New Project</span>
                  </div>
                </button>
                
                <button class="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-sm hover:shadow-md" data-action="view_reports">
                  <div class="flex items-center justify-center space-x-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <span>View Reports</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        `,
        display: { type: 'window', size: 'large', position: 'smart' },
        context: { id: 'dashboard-' + Date.now(), parent: null, purpose: 'main_dashboard', workflow: 'user_onboarding' },
        interactions: {
          'new_project': {
            action: 'create_project',
            nextPrompt: 'Please create a new project form'
          },
          'view_reports': {
            action: 'view_reports',
            nextPrompt: 'Please create a reports page'
          }
        },
        effects: { entrance: 'zoomIn', duration: 400 }
      }
    };

    // Determine response type based on input
    let responseType: keyof typeof responses = 'login';
    if (input.toLowerCase().includes('dashboard')) responseType = 'dashboard';
    if (input.toLowerCase().includes('contact')) responseType = 'login'; // Reuse login for contact
    if (input.toLowerCase().includes('product')) responseType = 'dashboard'; // Reuse dashboard for product
    if (input.toLowerCase().includes('notification')) responseType = 'login';
    if (input.toLowerCase().includes('modal')) responseType = 'login';
    if (input.toLowerCase().includes('table')) responseType = 'dashboard';
    if (input.toLowerCase().includes('settings')) responseType = 'dashboard';

    const response = responses[responseType] || responses['login'];
    console.log('Generated HTML:', response.html);
    return response;
  }
}

// Initialize UI Runtime
let uiRuntime: UIRuntime | null = null;
let logCount = 0;

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const logPanel = document.getElementById('logPanel');
  if (!logPanel) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  
  // 인라인 스타일로 로그 타입별 색상 적용
  const colors = {
    info: '#60a5fa',
    success: '#34d399', 
    error: '#f87171',
    warning: '#fbbf24'
  };
  
  logEntry.style.cssText = `
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
    color: ${colors[type]};
  `;
  logEntry.textContent = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  logPanel.appendChild(logEntry);
  logPanel.scrollTop = logPanel.scrollHeight;
  logCount++;
}

function updateStatus(): void {
  if (!uiRuntime) return;
  
  const activeWindows = uiRuntime.windows.getActiveWindows();
  const focusedWindow = uiRuntime.windows.getFocusedWindow();
  const conversationHistory = uiRuntime.context.getConversationHistory();
  
  const runtimeStateEl = document.getElementById('runtimeState');
  const activeWindowsEl = document.getElementById('activeWindows');
  const focusedWindowEl = document.getElementById('focusedWindow');
  const conversationCountEl = document.getElementById('conversationCount');
  
  if (runtimeStateEl) runtimeStateEl.textContent = 'Running';
  if (activeWindowsEl) activeWindowsEl.textContent = activeWindows.length.toString();
  if (focusedWindowEl) focusedWindowEl.textContent = focusedWindow?.id || 'None';
  if (conversationCountEl) conversationCountEl.textContent = conversationHistory.length.toString();
}

async function initializeRuntime(): Promise<void> {
  try {
    log('Initializing BaroCSS UI Runtime...', 'info');

    console.log('UIRuntime class:', UIRuntime);
    console.log('UIRuntime constructor:', typeof UIRuntime);
    
    uiRuntime = new UIRuntime({
      ai: new MockAIService(),
      logLevel: 'debug',
      onBeforeRender: (response) => {
        log(`Before render: ${response.display.type} - ${response.context.id}`, 'info');
        console.log('Before render response:', response);
      },
      onAfterRender: (window) => {
        log(`After render: ${window.id} - ${window.type}`, 'success');
        console.log('After render window:', window);
        updateStatus();
      },
      onError: (error) => {
        log(`Error: ${error.message}`, 'error');
        console.error('UIRuntime error:', error);
      }
    });

    log('UI Runtime initialized successfully', 'success');
    updateStatus();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed to initialize UI Runtime: ${errorMessage}`, 'error');
    console.error('Initialization error:', error);
  }
}

async function generateUI(prompt: string): Promise<void> {
  if (!uiRuntime) {
    log('UI Runtime not initialized', 'error');
    return;
  }

  try {
    log(`Generating UI for: "${prompt}"`, 'info');
    
    const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
    }

    const result = await uiRuntime.processUserInput(prompt);
    
    if (result.success) {
      log('UI generated successfully', 'success');
      
      // Clear previous UI
      const container = document.getElementById('uiContainer');
      if (container) {
        container.innerHTML = '';
        
        // 인라인 스타일로 has-content 효과 적용
        container.style.cssText = `
          min-height: 200px;
          border: 2px solid #10b981;
          border-radius: 0.5rem;
          padding: 1rem;
          background: white;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          color: #6b7280;
          font-style: italic;
        `;
        
        // Add new UI
        if (result.element) {
          container.appendChild(result.element);
        }
      }
    } else {
      log('Failed to generate UI', 'error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error generating UI: ${errorMessage}`, 'error');
  } finally {
    const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate UI';
    }
    updateStatus();
  }
}

// Event listeners setup
function setupEventListeners(): void {
  const generateBtn = document.getElementById('generateBtn');
  const userInput = document.getElementById('userInput') as HTMLInputElement;
  const quickButtons = document.querySelectorAll('.quick-button');

  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const input = userInput?.value.trim();
      if (input) {
        generateUI(input);
      }
    });
  }

  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const input = userInput.value.trim();
        if (input) {
          generateUI(input);
        }
      }
    });
  }

  // Quick action buttons
  quickButtons.forEach(button => {
    button.addEventListener('click', () => {
      const prompt = button.getAttribute('data-prompt');
      if (prompt && userInput) {
        userInput.value = prompt;
        generateUI(prompt);
      }
    });
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initializeRuntime();
});

// Export for potential external use
export { initializeRuntime, generateUI, log, updateStatus };
