module.exports = {
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    env: {
        es6: true,
        node: true,
    },
    rules: {
        'no-var': 'error',
        semi: 'error',
        indent: ['error', 4],
        'no-multi-spaces': 'error',
        'space-in-parens': 'error',
        'no-multiple-empty-lines': 'error',
        'prefer-const': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
    },
    ignorePatterns: ['jest.*.js', 'node_modules', '.idea_notes'],
    plugins: ['@typescript-eslint', 'prettier'],
};
