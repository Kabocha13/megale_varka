import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCESS_CONTROL,
  ACCESSIBLE,
  BIOMETRY_TYPE,
  getGenericPassword,
  getSupportedBiometryType,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';

// アプリロック（生体認証）。
// 健康情報・就活情報を守るため、有効化すると起動時・復帰時に
// Face ID / Touch ID / 指紋認証などでのロック解除を求める。
// 秘密値そのものに意味はなく、「生体認証に成功しないと読み出せない」
// キーチェーンエントリを読めたかどうかで認証成否を判定する。

export const APP_LOCK_ENABLED_KEY = '@app_lock_enabled_v1';
const APP_LOCK_SERVICE = 'app_lock';

export async function getBiometryType(): Promise<BIOMETRY_TYPE | null> {
  try {
    return await getSupportedBiometryType();
  } catch {
    return null;
  }
}

export function biometryLabel(type: BIOMETRY_TYPE | null): string {
  switch (type) {
    case BIOMETRY_TYPE.FACE_ID:
      return 'Face ID';
    case BIOMETRY_TYPE.TOUCH_ID:
      return 'Touch ID';
    case BIOMETRY_TYPE.FACE:
      return '顔認証';
    case BIOMETRY_TYPE.IRIS:
      return '虹彩認証';
    case BIOMETRY_TYPE.FINGERPRINT:
      return '指紋認証';
    default:
      return '生体認証';
  }
}

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function enableAppLock(): Promise<void> {
  await setGenericPassword('app_lock', 'unlock-token', {
    service: APP_LOCK_SERVICE,
    // 生体認証（端末パスコードへのフォールバック付き）を必須にする。
    // パスコードフォールバックを許可することで、生体情報の再登録などで
    // 認証できなくなり締め出される事故を防ぐ。
    accessControl: ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
}

export async function disableAppLock(): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'false');
  try {
    await resetGenericPassword({ service: APP_LOCK_SERVICE });
  } catch {
    // エントリが無い場合などは無視
  }
}

/** 生体認証プロンプトを表示し、成功したら true を返す。 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const credentials = await getGenericPassword({
      service: APP_LOCK_SERVICE,
      authenticationPrompt: {
        title: 'ロックを解除',
        subtitle: '健康情報・就活情報を保護しています',
        cancel: 'キャンセル',
      },
    });
    return credentials !== false;
  } catch {
    return false;
  }
}
