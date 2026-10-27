import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
      'no-console': 'warn',
    },
  },
  // PKG-g (O97): the CAD layers' boundary. The model (@barocss/cad-model) imports no UI, no GPU and no app; the kernel
  // (@barocss/cad) imports nothing of the model.
  {
    files: ['packages/barocss-cad-model/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: '@barocss/cad-model has no UI: React stays in the app.' },
        { group: ['@barocss/gpu', '@barocss/gpu/*'], message: '@barocss/cad-model has no GPU: rendering stays in the app.' },
        { group: ['**/apps/**', '@barocss/cad-studio-app', '@barocss/cad-studio-app/*'], message: '@barocss/cad-model imports nothing of an app.' },
        { group: ['@barocss/cad-model', '@barocss/cad-model/*'], message: 'Inside @barocss/cad-model, import its modules by relative path: a package does not import itself by name.' },
      ] }],
    },
  },
  {
    files: ['packages/barocss-cad/**/*.{ts,mjs,js}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@barocss/cad-model', '@barocss/cad-model/*'], message: 'The kernel (@barocss/cad) imports nothing of the model above it.' },
      ] }],
    },
  },
  // P4 (2026-10-27, apps/cad-studio/handover/notes/research-js-perf-review-2026-10-27.md): in the kernel's hot folders a
  // function made in a loop must not read a variable the loop changes. Bind the value to a const first, or mark a
  // callback that runs at once and gathers into the variable with a reasoned disable comment.
  {
    files: ['packages/barocss-cad/src/{brep,intersect,core,blend,mesh}/**/*.ts'],
    rules: {
      'no-loop-func': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'apps/barocss-docs/**',
      '*.config.js',
      '*.config.ts',
    ],
  }
)
