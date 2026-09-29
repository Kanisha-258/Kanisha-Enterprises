import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Fetching data on mount and then calling setState from the resolved
      // promise is the intended pattern here. The rule can't tell an async
      // .then(setState) apart from a synchronous setState in the effect body,
      // so it flags every loader. The alternative — a data library — isn't
      // worth the dependency for this project.
      'react-hooks/set-state-in-effect': 'off',

      // Several modules export small helpers alongside their component
      // (e.g. Badge.jsx also exports ORDER_STATUS, Spinner.jsx also exports
      // LoadingState). That's deliberate and doesn't harm hot reloading.
      'react-refresh/only-export-components': 'off',
    },
  },
])
