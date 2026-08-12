/**
 * Conventional Commits. Định dạng: <type>(<scope>): <mô tả>
 * Ví dụ: feat(orders): deduct stock inside order transaction
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', ['web', 'api', 'shared', 'infra', 'db', 'ci', 'docs', 'deps']],
  },
};
