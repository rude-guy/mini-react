const { defaults } = require('jest-config');

module.exports = {
  ...defaults,
  rootDir: process.cwd(),
  modulePathIgnorePatterns: ['<rootDir>/.history'],
  moduleDirectories: [
    // 对于三方依赖
    ...defaults.moduleDirectories,
    // 对于react DOM
    'dist/node_modules',
  ],
  testEnvironment: 'jsdom',
};
