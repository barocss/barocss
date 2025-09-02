import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BaroCSS',
  description: 'real-time CSS engine',
  lang: 'en-US',
  
  // Theme configuration
  themeConfig: {
    logo: '/logo-css-lightning.svg',
    siteTitle: 'BaroCSS',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'GitHub', link: 'https://github.com/barocss/barocss' }
    ],
    
    // Sidebar
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'JIT Mode', link: '/guide/jit-mode' },
            { text: 'Real-time Generation', link: '/guide/real-time' },
            { text: 'CSS Variables', link: '/guide/css-variables' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Core', link: '/api/core' },
            { text: 'Runtime', link: '/api/runtime' },
            { text: 'Plugins', link: '/api/plugins' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'React App', link: '/examples/react-app' },
            { text: 'Vue App', link: '/examples/vue-app' },
            { text: 'Landing Page', link: '/examples/landing-page' }
          ]
        }
      ]
    },
    
    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/barocss/barocss' },
      { icon: 'twitter', link: 'https://twitter.com/barocss' }
    ],
    
    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 BaroCSS'
    }
  },
  
  // Build configuration
  outDir: '../../dist/docs',
  
  // Custom CSS - minimal version
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3B82F6' }],
    ['style', {}, `
      /* Code block customization */
      .vp-code-block {
        background-color: #1e1e1e !important;
        color: #d4d4d4 !important;
      }
      
      /* Code line highlighting */
      .vp-code-line-highlight {
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-left: 2px solid rgba(59, 130, 246, 0.3) !important;
      }
      
      /* Inline code */
      :not(pre) > code {
        background-color: #2d2d2d !important;
        color: #e6e6e6 !important;
        border: 1px solid #404040 !important;
      }
      
      /* Code block header */
      .vp-code-block .vp-code-block__header {
        background-color: #2d2d2d !important;
        border-bottom: 1px solid #404040 !important;
      }
    `]
  ],
  
  // Markdown configuration
  markdown: {
    lineNumbers: true
  }
})
