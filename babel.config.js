module.exports = function (api) {
  // Jest 実行時は .env を要求せず、__mocks__/@env.js（moduleNameMapper）を使う
  const isTest = api.env('test');
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: isTest
      ? []
      : [
          [
            'module:react-native-dotenv',
            {
              moduleName: '@env',
              path: '.env',
              allowUndefined: false,
            },
          ],
        ],
  };
};
