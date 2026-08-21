// infra/cdk/jest.config.js

module.exports = {
  testEnvironment: "node",

  roots: [
    "<rootDir>/test",
  ],

  testMatch: [
    "**/*.test.ts",
  ],

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig:
          "<rootDir>/test/tsconfig.json",
      },
    ],
  },

  clearMocks: true,
};