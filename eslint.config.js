import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
        },
      },
    },
    rules: {
      /**
       * macOS và Windows không phân biệt hoa thường trong tên tệp, container
       * Linux và CI thì có. Không có luật này, một import sai hoa thường chạy
       * được trên máy phát triển và chỉ hỏng khi build trong container.
       */
      'import/no-unresolved': ['error', { caseSensitive: true, caseSensitiveStrict: true }],

      // Cấm any theo quy ước code. Không biết kiểu thì dùng unknown rồi thu hẹp.
      '@typescript-eslint/no-explicit-any': 'error',

      // console chỉ được dùng trong script CLI, mã ứng dụng dùng logger.
      'no-console': 'error',
    },
  },

  {
    // Vue SFC dùng vue-eslint-parser ở lớp ngoài, TypeScript ở phần <script>.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  {
    files: ['**/*.test.ts', '**/vitest.config.ts', '**/vite.config.ts', 'eslint.config.js'],
    rules: {
      'no-console': 'off',
    },
  },

  // Đặt cuối cùng để tắt mọi luật về định dạng — việc đó thuộc về Prettier.
  prettierConfig,
);
