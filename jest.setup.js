/* eslint-env jest */
/**
 * Jest 用のネイティブモジュールモック。
 * テスト環境にはネイティブバイナリが無いため、ネイティブ実装を持つ
 * ライブラリはここで JS モックに差し替える。
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  const mock = {
    setItem: jest.fn(async (key, value) => { store[key] = String(value); }),
    getItem: jest.fn(async key => (key in store ? store[key] : null)),
    removeItem: jest.fn(async key => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async keys => keys.map(k => [k, store[k] ?? null])),
    multiSet: jest.fn(async pairs => { pairs.forEach(([k, v]) => { store[k] = v; }); }),
    multiRemove: jest.fn(async keys => { keys.forEach(k => delete store[k]); }),
  };
  return {
    __esModule: true,
    default: mock,
    createAsyncStorage: () => mock,
  };
});

jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'BiometryAny',
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly',
  },
  BIOMETRY_TYPE: {
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
    FINGERPRINT: 'Fingerprint',
    FACE: 'Face',
    IRIS: 'Iris',
  },
  getSupportedBiometryType: jest.fn(async () => null),
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
  isErrorWithCode: error => !!error && typeof error.code === 'string',
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    performRequest: jest.fn(async () => ({ identityToken: null, nonce: undefined })),
    Operation: { LOGIN: 1 },
    Scope: { FULL_NAME: 0, EMAIL: 1 },
    Error: { CANCELED: '1001' },
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    createChannel: jest.fn(async () => 'channel'),
    createTriggerNotification: jest.fn(async () => 'id'),
    cancelTriggerNotification: jest.fn(async () => {}),
  },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 },
}));

jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: jest.fn(() => false),
  queryCategorySamples: jest.fn(async () => []),
  queryStatisticsForQuantity: jest.fn(async () => null),
  requestAuthorization: jest.fn(async () => true),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn(async () => '') },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const mockComponent = () => null;
  return { __esModule: true, default: mockComponent };
});
