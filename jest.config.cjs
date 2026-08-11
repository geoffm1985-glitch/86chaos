module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.js', '**/*.test.jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/scripts/jest/styleMock.cjs',
    '\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$': '<rootDir>/scripts/jest/fileMock.cjs'
  }
};
