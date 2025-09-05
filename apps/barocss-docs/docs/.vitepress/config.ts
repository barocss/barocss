import { defineConfig } from 'vitepress'
import { withMermaid } from "vitepress-plugin-mermaid";

export default defineConfig(withMermaid({
  title: 'BaroCSS',
  description: 'real-time CSS engine',
  lang: 'en-US',

  mermaidPlugin: {
    class: "mermaid my-class", // set additional css classes for parent container 
  },
  
  // Blog configuration
  blog: {
    postsPerPage: 10,
    postDir: 'blog',
    tagDir: 'blog/tags',
    categoryDir: 'blog/categories'
  },
  
  // Theme configuration
  themeConfig: {
    logo: '/logo-css-lightning.svg',
    siteTitle: 'BaroCSS',

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/barocss/barocss/edit/main/apps/barocss-docs/docs/:path',
      text: 'Edit this page'
    },
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Blog', link: '/blog/' },
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
            { text: 'CDN Usage', link: '/guide/cdn-usage' },
            { text: 'Quick Start', link: '/guide/quick-start' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'JIT Mode', link: '/guide/jit-mode' },
            { text: 'Real-time Generation', link: '/guide/real-time-generation' },
            { text: 'Incremental Parsing', link: '/guide/incremental-parsing' },
            { text: 'DOM Change Detection', link: '/guide/dom-change-detection' },
            { text: 'Smart Caching', link: '/guide/smart-caching' },
            { text: 'Runtime APIs', link: '/guide/runtime-apis' },
            { text: 'CSS Variables', link: '/guide/css-variables' }
          ]
        },
        {
          text: 'AI Integration',
          items: [
            { text: 'Overview', link: '/guide/ai-integration' },
            { text: 'Build-free UI Generation', link: '/guide/ai-integration/build-free-ui' },
            { text: 'Vanilla HTML', link: '/guide/ai-integration/vanilla-html' },
            { text: 'React', link: '/guide/ai-integration/react' },
            { text: 'Vue', link: '/guide/ai-integration/vue' },
            { text: 'Svelte', link: '/guide/ai-integration/svelte' },
            { text: 'SolidJS', link: '/guide/ai-integration/solid' },
            { text: 'jQuery', link: '/guide/ai-integration/jquery' },
            { text: 'Partial UI Updates', link: '/guide/ai-integration/partial-updates' }
          ]
        },
        {
          text: 'Styling',
          items: [
            { text: 'Styling with Utility Classes', link: '/guide/styling-with-utility-classes' },
            { text: 'Hover, Focus and Other States', link: '/guide/hover-focus-and-other-states' },
            {
              text: 'Variants',
              items: [
                { text: 'Overview', link: '/guide/variants/' },
                { text: 'Pseudo-classes', link: '/guide/variants/pseudo-classes' },
                { text: 'Pseudo-elements', link: '/guide/variants/pseudo-elements' },
                { text: 'Media Queries', link: '/guide/variants/media-queries' },
                { text: 'Attribute Selectors', link: '/guide/variants/attribute-selectors' },
                { text: 'Child Selectors', link: '/guide/variants/child-selectors' },
                { text: 'Custom Variants', link: '/guide/variants/custom-variants' }
              ]
            },
            { text: 'Responsive Design', link: '/guide/responsive-design' },
            { text: 'Dark Mode', link: '/guide/dark-mode' },
            { text: 'Theme Variables', link: '/guide/theme-variables' },
            { text: 'Colors', link: '/guide/colors' },
            { text: 'Adding Custom Styles', link: '/guide/adding-custom-styles' },
            { text: 'Functions and Directives', link: '/guide/functions-and-directives' }
          ]
        },

        {
          text: 'Theme',
          items: [
            { text: 'Theme Overview', link: '/guide/theme/' },
            { text: 'Theme Namespaces', link: '/guide/theme/namespaces' },
            { text: 'Customizing Theme', link: '/guide/theme/customizing' },
            { text: 'Using Theme Variables', link: '/guide/theme/using-variables' },
            { text: 'Default Theme Reference', link: '/guide/theme/default-reference' },
            { text: 'Theme Best Practices', link: '/guide/theme/best-practices' }
          ]
        },
        {
          text: 'Functions & Directives',
          items: [
            { text: 'Functions and Directives', link: '/guide/functions-and-directives' }
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Detecting Classes in Source Files', link: '/guide/detecting-classes-in-source-files' },
          ]
        },
        {
          text: 'Layout',
          items: [
            { text: 'Display', link: '/guide/layout/display' },
            { text: 'Position', link: '/guide/layout/position' },
            { text: 'Top / Right / Bottom / Left', link: '/guide/layout/top-right-bottom-left' },
            { text: 'Z-Index', link: '/guide/layout/z-index' },
            { text: 'Float', link: '/guide/layout/float' },
            { text: 'Clear', link: '/guide/layout/clear' },
            { text: 'Object Fit', link: '/guide/layout/object-fit' },
            { text: 'Object Position', link: '/guide/layout/object-position' },
            { text: 'Overflow', link: '/guide/layout/overflow' },
            { text: 'Overscroll Behavior', link: '/guide/layout/overscroll-behavior' },
            { text: 'Visibility', link: '/guide/layout/visibility' },
            { text: 'Isolation', link: '/guide/layout/isolation' },
            { text: 'Aspect Ratio', link: '/guide/layout/aspect-ratio' },
            { text: 'Box Sizing', link: '/guide/layout/box-sizing' },
            { text: 'Box Decoration Break', link: '/guide/layout/box-decoration-break' },
            { text: 'Break After', link: '/guide/layout/break-after' },
            { text: 'Break Before', link: '/guide/layout/break-before' },
            { text: 'Break Inside', link: '/guide/layout/break-inside' },
            { text: 'Columns', link: '/guide/layout/columns' }
          ]
        },
        {
          text: 'Flexbox & Grid',
          items: [
            { text: 'Flex', link: '/guide/flexbox-grid/flex' },
            { text: 'Flex Direction', link: '/guide/flexbox-grid/flex-direction' },
            { text: 'Flex Wrap', link: '/guide/flexbox-grid/flex-wrap' },
            { text: 'Flex Grow', link: '/guide/flexbox-grid/flex-grow' },
            { text: 'Flex Shrink', link: '/guide/flexbox-grid/flex-shrink' },
            { text: 'Flex Basis', link: '/guide/flexbox-grid/flex-basis' },
            { text: 'Order', link: '/guide/flexbox-grid/order' },
            { text: 'Justify Content', link: '/guide/flexbox-grid/justify-content' },
            { text: 'Justify Items', link: '/guide/flexbox-grid/justify-items' },
            { text: 'Justify Self', link: '/guide/flexbox-grid/justify-self' },
            { text: 'Align Content', link: '/guide/flexbox-grid/align-content' },
            { text: 'Align Items', link: '/guide/flexbox-grid/align-items' },
            { text: 'Align Self', link: '/guide/flexbox-grid/align-self' },
            { text: 'Place Content', link: '/guide/flexbox-grid/place-content' },
            { text: 'Place Items', link: '/guide/flexbox-grid/place-items' },
            { text: 'Place Self', link: '/guide/flexbox-grid/place-self' },
            { text: 'Gap', link: '/guide/flexbox-grid/gap' },
            { text: 'Grid Template Columns', link: '/guide/flexbox-grid/grid-template-columns' },
            { text: 'Grid Template Rows', link: '/guide/flexbox-grid/grid-template-rows' },
            { text: 'Grid Column', link: '/guide/flexbox-grid/grid-column' },
            { text: 'Grid Row', link: '/guide/flexbox-grid/grid-row' },
            { text: 'Grid Auto Flow', link: '/guide/flexbox-grid/grid-auto-flow' },
            { text: 'Grid Auto Columns', link: '/guide/flexbox-grid/grid-auto-columns' },
            { text: 'Grid Auto Rows', link: '/guide/flexbox-grid/grid-auto-rows' }
          ]
        },
        {
          text: 'Spacing',
          items: [
            { text: 'Padding', link: '/guide/spacing/padding' },
            { text: 'Margin', link: '/guide/spacing/margin' }
          ]
        },
        {
          text: 'Sizing',
          items: [
            { text: 'Width', link: '/guide/sizing/width' },
            { text: 'Min Width', link: '/guide/sizing/min-width' },
            { text: 'Max Width', link: '/guide/sizing/max-width' },
            { text: 'Height', link: '/guide/sizing/height' },
            { text: 'Min Height', link: '/guide/sizing/min-height' },
            { text: 'Max Height', link: '/guide/sizing/max-height' }
          ]
        },
        {
          text: 'Typography',
          items: [
            { text: 'Font Family', link: '/guide/typography/font-family' },
            { text: 'Font Size', link: '/guide/typography/font-size' },
            { text: 'Font Weight', link: '/guide/typography/font-weight' },
            { text: 'Font Style', link: '/guide/typography/font-style' },
            { text: 'Font Stretch', link: '/guide/typography/font-stretch' },
            { text: 'Font Variant Numeric', link: '/guide/typography/font-variant-numeric' },
            { text: 'Line Height', link: '/guide/typography/line-height' },
            { text: 'Letter Spacing', link: '/guide/typography/letter-spacing' },
            { text: 'Text Color', link: '/guide/typography/color' },
            { text: 'Text Align', link: '/guide/typography/text-align' },
            { text: 'Text Indent', link: '/guide/typography/text-indent' },
            { text: 'Vertical Align', link: '/guide/typography/vertical-align' },
            { text: 'Text Decoration', link: '/guide/typography/text-decoration' },
            { text: 'Text Decoration Color', link: '/guide/typography/text-decoration-color' },
            { text: 'Text Decoration Style', link: '/guide/typography/text-decoration-style' },
            { text: 'Text Decoration Thickness', link: '/guide/typography/text-decoration-thickness' },
            { text: 'Text Underline Offset', link: '/guide/typography/text-underline-offset' },
            { text: 'Text Transform', link: '/guide/typography/text-transform' },
            { text: 'Text Overflow', link: '/guide/typography/text-overflow' },
            { text: 'Text Shadow', link: '/guide/typography/text-shadow' },
            { text: 'White Space', link: '/guide/typography/white-space' },
            { text: 'Word Break', link: '/guide/typography/word-break' },
            { text: 'Overflow Wrap', link: '/guide/typography/overflow-wrap' },
            { text: 'Hyphens', link: '/guide/typography/hyphens' },
            { text: 'Content', link: '/guide/typography/content' },
            { text: 'Line Clamp', link: '/guide/typography/line-clamp' },
            { text: 'Text Wrap', link: '/guide/typography/text-wrap' },
            { text: 'Font Smoothing', link: '/guide/typography/font-smoothing' }
          ]
        },
        {
          text: 'Backgrounds',
          items: [
            { text: 'Background Color', link: '/guide/backgrounds/background-color' },
            { text: 'Background Image', link: '/guide/backgrounds/background-image' },
            { text: 'Background Position', link: '/guide/backgrounds/background-position' },
            { text: 'Background Size', link: '/guide/backgrounds/background-size' },
            { text: 'Background Repeat', link: '/guide/backgrounds/background-repeat' },
            { text: 'Background Origin', link: '/guide/backgrounds/background-origin' },
            { text: 'Background Clip', link: '/guide/backgrounds/background-clip' },
            { text: 'Background Attachment', link: '/guide/backgrounds/background-attachment' }
          ]
        },
        {
          text: 'Borders',
          items: [
            { text: 'Border Width', link: '/guide/borders/border-width' },
            { text: 'Border Color', link: '/guide/borders/border-color' },
            { text: 'Border Style', link: '/guide/borders/border-style' },
            { text: 'Border Radius', link: '/guide/borders/border-radius' },
            { text: 'Outline Width', link: '/guide/borders/outline-width' },
            { text: 'Outline Color', link: '/guide/borders/outline-color' },
            { text: 'Outline Style', link: '/guide/borders/outline-style' },
            { text: 'Outline Offset', link: '/guide/borders/outline-offset' }
          ]
        },
        {
          text: 'Effects',
          items: [
            { text: 'Box Shadow', link: '/guide/effects/box-shadow' },
            { text: 'Text Shadow', link: '/guide/effects/text-shadow' },
            { text: 'Opacity', link: '/guide/effects/opacity' },
            { text: 'Mix Blend Mode', link: '/guide/effects/mix-blend-mode' },
            { text: 'Background Blend Mode', link: '/guide/effects/background-blend-mode' }
          ]
        },
        {
          text: 'Filters',
          items: [
            {
              text: 'Filter',
              link: '/guide/filters/filter',
              items: [
                { text: 'Blur', link: '/guide/filters/blur' },
                { text: 'Brightness', link: '/guide/filters/brightness' },
                { text: 'Contrast', link: '/guide/filters/contrast' },
                { text: 'Drop Shadow', link: '/guide/filters/drop-shadow' },
                { text: 'Grayscale', link: '/guide/filters/grayscale' },
                { text: 'Hue Rotate', link: '/guide/filters/hue-rotate' },
                { text: 'Invert', link: '/guide/filters/invert' },
                { text: 'Saturate', link: '/guide/filters/saturate' },
                { text: 'Sepia', link: '/guide/filters/sepia' }
              ]
            },
            {
              text: 'Backdrop Filter',
              link: '/guide/filters/backdrop-filter',
              items: [
                { text: 'Blur', link: '/guide/filters/backdrop/blur' },
                { text: 'Brightness', link: '/guide/filters/backdrop/brightness' },
                { text: 'Contrast', link: '/guide/filters/backdrop/contrast' },
                { text: 'Grayscale', link: '/guide/filters/backdrop/grayscale' },
                { text: 'Hue Rotate', link: '/guide/filters/backdrop/hue-rotate' },
                { text: 'Invert', link: '/guide/filters/backdrop/invert' },
                { text: 'Opacity', link: '/guide/filters/backdrop/opacity' },
                { text: 'Saturate', link: '/guide/filters/backdrop/saturate' },
                { text: 'Sepia', link: '/guide/filters/backdrop/sepia' }
              ]
            }
          ]
        },
        {
          text: 'Tables',
          items: [
            { text: 'Table Layout', link: '/guide/tables/table-layout' },
            { text: 'Border Collapse', link: '/guide/tables/border-collapse' },
            { text: 'Border Spacing', link: '/guide/tables/border-spacing' },
            { text: 'Caption Side', link: '/guide/tables/caption-side' }
          ]
        },
        {
          text: 'Transitions & Animations',
          items: [
            { text: 'Transition Property', link: '/guide/transitions-animations/transition-property' },
            { text: 'Transition Duration', link: '/guide/transitions-animations/transition-duration' },
            { text: 'Transition Delay', link: '/guide/transitions-animations/transition-delay' },
            { text: 'Transition Timing Function', link: '/guide/transitions-animations/transition-timing-function' },
            { text: 'Transition Behavior', link: '/guide/transitions-animations/transition-behavior' },
            { text: 'Animation', link: '/guide/transitions-animations/animation' }
          ]
        },
        {
          text: 'Transforms',
          items: [
            { text: 'Transform', link: '/guide/transforms/transform' },
            { text: 'Transform Origin', link: '/guide/transforms/transform-origin' },
            { text: 'Transform Style', link: '/guide/transforms/transform-style' },
            { text: 'Rotate', link: '/guide/transforms/rotate' },
            { text: 'Scale', link: '/guide/transforms/scale' },
            { text: 'Translate', link: '/guide/transforms/translate' },
            { text: 'Skew', link: '/guide/transforms/skew' },
            { text: 'Perspective', link: '/guide/transforms/perspective' },
            { text: 'Perspective Origin', link: '/guide/transforms/perspective-origin' },
            { text: 'Backface Visibility', link: '/guide/transforms/backface-visibility' }
          ]
        },
        {
          text: 'Interactivity',
          items: [
            { text: 'Cursor', link: '/guide/interactivity/cursor' },
            { text: 'User Select', link: '/guide/interactivity/user-select' },
            { text: 'Pointer Events', link: '/guide/interactivity/pointer-events' },
            { text: 'Resize', link: '/guide/interactivity/resize' },
            { text: 'Scroll Behavior', link: '/guide/interactivity/scroll-behavior' },
            { text: 'Scroll Margin', link: '/guide/interactivity/scroll-margin' },
            { text: 'Scroll Padding', link: '/guide/interactivity/scroll-padding' },
            { text: 'Scroll Snap Align', link: '/guide/interactivity/scroll-snap-align' },
            { text: 'Scroll Snap Stop', link: '/guide/interactivity/scroll-snap-stop' },
            { text: 'Scroll Snap Type', link: '/guide/interactivity/scroll-snap-type' },
            { text: 'Touch Action', link: '/guide/interactivity/touch-action' },
            { text: 'Will Change', link: '/guide/interactivity/will-change' },
            { text: 'Accent Color', link: '/guide/interactivity/accent-color' },
            { text: 'Appearance', link: '/guide/interactivity/appearance' },
            { text: 'Caret Color', link: '/guide/interactivity/caret-color' },
            { text: 'Color Scheme', link: '/guide/interactivity/color-scheme' },
            { text: 'Field Sizing', link: '/guide/interactivity/field-sizing' }
          ]
        },
        {
          text: 'SVG',
          items: [
            { text: 'Fill', link: '/guide/svg/fill' },
            { text: 'Stroke', link: '/guide/svg/stroke' },
            { text: 'Stroke Width', link: '/guide/svg/stroke-width' }
          ]
        },
        {
          text: 'Accessibility',
          items: [
            { text: 'Forced Color Adjust', link: '/guide/accessibility/forced-color-adjust' }
          ]
        },
        {
          text: 'Compatibility & Setup',
          items: [
            { text: 'Compatibility', link: '/guide/compatibility' },
            { text: 'Upgrade Guide', link: '/guide/upgrade-guide' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Context API', link: '/api/context' },
            { text: 'Engine API', link: '/api/engine' },
            { text: 'Browser Runtime', link: '/api/browser-runtime' },
            { text: 'Server Runtime', link: '/api/server-runtime' },
            { text: 'Plugin System', link: '/api/plugins' },
            { text: 'Configuration', link: '/api/configuration' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' }
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
  // outDir: '../../dist/docs',
  
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
}))
