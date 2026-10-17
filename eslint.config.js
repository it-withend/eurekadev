import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Architecture guard: lower layers must not depend on higher ones.
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/dsp/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@core/*', '@experiments/*', '@ui/*', 'react'] }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@experiments/*', '@ui/*', 'react'] }],
    },
  },
  {
    files: ['src/experiments/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@ui/*', 'react', 'react-dom'] }],
    },
  },
);
