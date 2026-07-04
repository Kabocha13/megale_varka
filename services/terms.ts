import AsyncStorage from '@react-native-async-storage/async-storage';

// 利用規約。内容を大きく改定したときは TERMS_VERSION を上げると、
// 既存ユーザーにも再同意画面が表示される。

export const TERMS_VERSION = 1;
export const TERMS_UPDATED_AT = '2026年7月4日';
export const DEVELOPER_NAME = '下田一颯';

const ACCEPTED_VERSION_KEY = '@accepted_terms_version_v1';

export interface TermsSection {
  heading: string;
  body: string;
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '第1条（適用）',
    body: '本規約は、下田一颯（以下「開発者」といいます）が提供するアプリ「megale_varka」（以下「本アプリ」といいます）の利用条件を定めるものです。利用者は、本規約に同意のうえ本アプリを利用するものとします。',
  },
  {
    heading: '第2条（利用登録）',
    body: '本アプリの一部機能の利用には、メールアドレス等によるアカウント登録が必要です。利用者は、登録情報を正確に保つものとし、アカウントの管理責任は利用者本人が負うものとします。',
  },
  {
    heading: '第3条（健康情報の取り扱い）',
    body: '本アプリは、利用者が記録した健康データ（歩数・睡眠・体調メモ等）を、利用者自身の健康管理を目的として端末および利用者ごとに分離されたデータベースに保存します。本アプリが提供する情報やアドバイスは医療行為・診断ではありません。体調に不安がある場合は医療機関に相談してください。',
  },
  {
    heading: '第4条（就職活動情報の取り扱い）',
    body: '本アプリに登録された企業情報・選考状況・エントリーシート等の就職活動に関する情報は、利用者本人のアカウントに紐づけて保存され、開発者が本アプリの提供・改善以外の目的で利用することはありません。企業マイページのパスワードは端末内の安全な領域（キーチェーン）にのみ保存されます。',
  },
  {
    heading: '第5条（禁止事項）',
    body: '利用者は、本アプリの利用にあたり、以下の行為をしてはなりません。\n・法令または公序良俗に違反する行為\n・本アプリの運営を妨害する行為\n・不正アクセスまたはこれを試みる行為\n・他の利用者または第三者の権利を侵害する行為\n・本アプリを逆コンパイル等により解析する行為',
  },
  {
    heading: '第6条（本アプリの提供の停止等）',
    body: '開発者は、システムの保守、障害、天災地変その他やむを得ない事由がある場合、利用者に事前に通知することなく、本アプリの全部または一部の提供を停止または中断することができるものとします。',
  },
  {
    heading: '第7条（免責事項）',
    body: '開発者は、本アプリに事実上または法律上の瑕疵がないことを保証するものではありません。本アプリの利用により利用者に生じたあらゆる損害（データの消失、就職活動上の不利益、健康上の問題等を含みます）について、開発者の故意または重過失による場合を除き、責任を負わないものとします。',
  },
  {
    heading: '第8条（利用規約の変更）',
    body: '開発者は、必要と判断した場合には、利用者への通知をもって本規約を変更することができるものとします。変更後の規約は、本アプリ内に表示した時点から効力を生じるものとします。',
  },
  {
    heading: '第9条（お問い合わせ）',
    body: '本規約に関するお問い合わせは、本アプリ内の「お問い合わせ」機能よりご連絡ください。',
  },
  {
    heading: '附則',
    body: `${TERMS_UPDATED_AT} 制定・施行\n開発者：${DEVELOPER_NAME}`,
  },
];

export async function getAcceptedTermsVersion(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ACCEPTED_VERSION_KEY);
    const parsed = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveAcceptedTermsVersion(): Promise<void> {
  await AsyncStorage.setItem(ACCEPTED_VERSION_KEY, String(TERMS_VERSION));
}
