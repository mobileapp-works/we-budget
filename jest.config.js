/**
 * Jest 設定。
 * 純粋なロジック（お金の計算・フォーマット等）のユニットテストのみを対象にする。
 * React Native コンポーネントは含めず、ts-jest + node 環境で高速・安定に実行する。
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // .ts のテストのみ対象（.tsx の RN コンポーネントは対象外）
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
