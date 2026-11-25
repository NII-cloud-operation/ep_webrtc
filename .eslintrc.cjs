'use strict';

// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('eslint-config-etherpad/patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: 'etherpad/plugin',
  overrides: [{files: ['static/js/backgroundBlur.js'], parserOptions: {ecmaVersion: 2020}}],
  ignorePatterns: [
    '/static/js/adapter.js',
  ],
};
