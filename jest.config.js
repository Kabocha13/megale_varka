module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@env$': '<rootDir>/__mocks__/@env.js',
    '\\.(ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // preset の setupFiles を上書きしてしまうため、RN 標準の setup も明示的に含める
  setupFiles: [
    require.resolve('@react-native/jest-preset/jest/setup.js'),
    '<rootDir>/jest.setup.js',
  ],
  // .mjs（@firebase/util など）も Babel で変換できるように preset の transform を拡張
  transform: {
    '^.+\\.(js|mjs|cjs|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  // ESM で配布されている RN ライブラリも Babel で変換する
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-native-google-signin|@react-native-vector-icons|@notifee|@invertase|@kingstinct|react-native-keychain|react-native-nitro-modules|firebase|@firebase)/)',
  ],
};
