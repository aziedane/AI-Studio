import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.rules'],
    languageOptions: {
      parser: firebaseRulesPlugin.parser,
    },
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin
    },
    rules: {
      ...firebaseRulesPlugin.configs['flat/recommended']?.rules
    }
  }
];
