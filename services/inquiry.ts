import { Platform } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// お問い合わせ。
// アプリ内フォームからの送信は Firestore の `inquiries` コレクションに保存し、
// 運営（開発者）が Firebase Console で確認する。
// メールでの問い合わせ先は SUPPORT_EMAIL。

export const SUPPORT_EMAIL = 'ishimoda.issa@gmail.com';

export const INQUIRY_CATEGORIES = [
  '不具合の報告',
  '機能の要望',
  'アカウント・データについて',
  'その他',
] as const;

export interface InquiryInput {
  uid: string | null;
  email: string | null;
  category: string;
  message: string;
}

export async function submitInquiry(input: InquiryInput): Promise<void> {
  await addDoc(collection(db, 'inquiries'), {
    uid: input.uid ?? null,
    email: input.email ?? '',
    category: input.category,
    message: input.message,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}

export function buildInquiryMailUrl(category: string, email: string | null): string {
  const subject = `【megale_varka】お問い合わせ${category ? `（${category}）` : ''}`;
  const bodyLines = [
    'お問い合わせ内容をご記入ください。',
    '',
    '---',
    `アカウント: ${email ?? '未ログイン'}`,
    `OS: ${Platform.OS}`,
  ];
  return (
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(bodyLines.join('\n'))}`
  );
}
