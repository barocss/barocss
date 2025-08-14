/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
            h1: {
              color: '#111827',
              fontWeight: '700',
              fontSize: '1.875rem',
              lineHeight: '2.25rem',
              marginTop: '2rem',
              marginBottom: '1.5rem',
            },
            h2: {
              color: '#111827',
              fontWeight: '600',
              fontSize: '1.5rem',
              lineHeight: '2rem',
              marginTop: '2rem',
              marginBottom: '1rem',
            },
            h3: {
              color: '#111827',
              fontWeight: '600',
              fontSize: '1.25rem',
              lineHeight: '1.75rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
            },
            h4: {
              color: '#111827',
              fontWeight: '500',
              fontSize: '1.125rem',
              lineHeight: '1.75rem',
              marginTop: '1rem',
              marginBottom: '0.5rem',
            },
            p: {
              marginTop: '0',
              marginBottom: '1rem',
              lineHeight: '1.75',
            },
            ul: {
              marginTop: '0',
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
            },
            ol: {
              marginTop: '0',
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
            },
            li: {
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
            blockquote: {
              borderLeftColor: '#3b82f6',
              borderLeftWidth: '4px',
              paddingLeft: '1rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0 0.5rem 0.5rem 0',
              marginBottom: '1rem',
            },
            'blockquote p': {
              margin: '0',
              fontStyle: 'italic',
            },
            a: {
              color: '#2563eb',
              textDecoration: 'underline',
              '&:hover': {
                color: '#1d4ed8',
              },
            },
            strong: {
              fontWeight: '600',
              color: '#111827',
            },
            em: {
              fontStyle: 'italic',
            },
            code: {
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontFamily: 'ui-monospace, SFMono-Regular, "Menlo", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
            'pre code': {
              backgroundColor: 'transparent',
              color: '#f9fafb',
              padding: '0',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 