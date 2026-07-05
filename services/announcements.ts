import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// 運営からのお知らせ。
// Firestore のトップレベルコレクション `announcements` に、運営（開発者）が
// Firebase Console から直接ドキュメントを追加する運用を想定している。
//   title: string / body: string / createdAt: Timestamp
// 既読管理は端末側（AsyncStorage）で行い、最後に読んだお知らせの
// createdAt より新しいものがあれば「NEW」ハイライトを表示する。

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAtMillis: number;
}

const LAST_READ_KEY = '@announcements_last_read_v1';
const FETCH_LIMIT = 30;

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(
    query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(FETCH_LIMIT),
    ),
  );
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: typeof data.title === 'string' ? data.title : '（無題）',
      body: typeof data.body === 'string' ? data.body : '',
      createdAtMillis: toMillis(data.createdAt),
    };
  });
}

export async function getLastReadMillis(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_READ_KEY);
    const parsed = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveLastReadMillis(millis: number): Promise<void> {
  await AsyncStorage.setItem(LAST_READ_KEY, String(millis));
}

export function countUnread(list: Announcement[], lastReadMillis: number): number {
  return list.filter(a => a.createdAtMillis > lastReadMillis).length;
}

export function formatAnnouncementDate(millis: number): string {
  if (!millis) return '';
  const d = new Date(millis);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
