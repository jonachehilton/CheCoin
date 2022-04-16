module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['airbnb-base', 'airbnb-typescript/base'],
  parserOptions: {
    project: './tsconfig.json'
  },
  rules: {
    'no-console': 'off',
    'max-len': 'off',
    'no-underscore-dangle': 'off',
    'no-restricted-syntax': 'off',
    'new-cap': 'off',
    'no-bitwise': 'off',
    'max-classes-per-file': 'off',
    'no-param-reassign': 'off',
  },
};