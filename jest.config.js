module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/frontend/src'],
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/*.(test|spec).(j|t)s?(x)'
  ],
  setupFilesAfterEnv: ['<rootDir>/frontend/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
  ],
  moduleFileExtensions: [
    'web.js',
    'js',
    'web.ts',
    'ts',
    'web.tsx',
    'tsx',
    'json',
    'web.jsx',
    'jsx',
    'node',
  ],
  collectCoverageFrom: [
    'frontend/src/**/*.{ts,tsx}',
    '!frontend/src/**/*.d.ts',
    '!frontend/src/**/index.{ts,tsx}',
    '!frontend/src/setupTests.{ts,tsx}',
    '!frontend/src/reportWebVitals.{ts,tsx}',
    '!frontend/src/**/types/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};