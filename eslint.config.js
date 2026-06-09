const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  { ignores: ['node_modules/', 'dist/', '.expo/', 'supabase/functions/'] },
  expoConfig,
  {
    rules: {
      // HTML entities don't apply in React Native
      'react/no-unescaped-entities': 'off',
    },
  },
])
