// Common JavaScript for BaroCSS site

// BaroCSS integration
import { BrowserRuntime } from 'barocss/runtime/browser';

let barocssRuntime = null;

// 로딩 완료 처리
function onBaroCSSReady() {
  // View Transition API 사용
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      document.body.classList.remove('barocss-loading');
      document.body.classList.add('barocss-loaded');
    });
  } else {
    // Fallback: 기존 방식
    document.body.classList.remove('barocss-loading');
    document.body.classList.add('barocss-loaded');
  }
}

// Initialize BaroCSS immediately
function initializeBaroCSS() {
  try {
    console.log('Initializing BaroCSS');
    // Create and initialize runtime
    barocssRuntime = new BrowserRuntime({
      config: {
        preflight: true,
      },
    });
    
    // Observe the entire document for utility classes
    barocssRuntime.observe(document.body, { scan: true, onReady: onBaroCSSReady });
    
    console.log('BaroCSS initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize BaroCSS:', error);
    onBaroCSSReady();
  }
}

// DOM is already ready
initializeBaroCSS();
