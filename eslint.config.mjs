// ESLint for each JavaScript and TypeScript file of the repository.
// The pre-commit hook runs it on the staged files. "npm run lint" runs it on all files.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.cache/**',
      'skills/**', '.agents/**', '.claude/skills/**',
      '**/astryx-themes.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // A rest pattern that drops one key is a common way to copy an object without it.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/mobile/ui/**/*.{ts,tsx}', 'apps/website/**/*.{ts,tsx}', 'apps/display-pow/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
];
