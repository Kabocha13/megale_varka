import {
  ACCESSIBLE,
  getGenericPassword,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';

// 企業ごとのマイページパスワードを端末のキーチェーン
// （iOS Keychain / Android Keystore）に保存する。
// Firestore や AsyncStorage には平文を書かない。

function serviceFor(companyId: string): string {
  return `mypage_password_${companyId}`;
}

export async function saveMyPagePassword(companyId: string, password: string): Promise<void> {
  if (!password) {
    await deleteMyPagePassword(companyId);
    return;
  }
  await setGenericPassword('mypage', password, {
    service: serviceFor(companyId),
    // この端末でロック解除中のみ読み出し可。iCloud等のバックアップにも含めない。
    accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getMyPagePassword(companyId: string): Promise<string> {
  try {
    const credentials = await getGenericPassword({ service: serviceFor(companyId) });
    return credentials ? credentials.password : '';
  } catch {
    return '';
  }
}

export async function deleteMyPagePassword(companyId: string): Promise<void> {
  try {
    await resetGenericPassword({ service: serviceFor(companyId) });
  } catch {
    // 削除失敗は無視（エントリが無い場合など）
  }
}
