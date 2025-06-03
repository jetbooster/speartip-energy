import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import eslintReact from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const customized = stylistic.configs.customize({
  // the following options are the default values
  indent: 2,
  quotes: 'single',
  semi: true,
  jsx: true,
  // ...
});

export default tseslint.config(
  {
    ignores: ["**/public/**/*", ".local/**/*", "node_modules/**/*", "src/coverage/**/*"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      '@stylistic': stylistic,
      'react': eslintReact,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...eslintReact.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      ...customized.rules,
      'react/react-in-jsx-scope': 0,
      '@stylistic/max-len': ['error', { code: 120 }]
    }
  },
)
