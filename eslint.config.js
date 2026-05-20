const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/', 'dist/', '.expo/'],
    rules: {
      // HTML entities don't apply in React Native
      'react/no-unescaped-entities': 'off',
    },
  },
])
