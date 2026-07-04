import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateStreakWidget } from '../modules/StreakBridge';

// --- Types ---
export type AppetiteValue = 'nothing' | 'water' | 'noodles' | 'set_meal' | 'steak';
export type DailyAnswer = 'none' | 'little' | 'some' | 'always';

export interface HealthRecord {
  date: string; // YYYY-MM-DD
  mood?: number;
  symptoms?: string[];
  otherNote?: string;
  appetite?: AppetiteValue;
  alcohol?: boolean;
  bedTime?: string;
  wakeTime?: string;
  sleepHours?: number;
  sleepSource?: string;
  steps?: number | null;
  activeCalories?: number | null;
  // Daily rotating CES-D style question — only the answer is stored;
  // the question itself is re-derived from the date at read time.
  dailyAnswer?: DailyAnswer;
  // true when the user filled this day retroactively (from a later date).
  // Retroactive entries are included in charts and the total-days count,
  // but don't light the "recorded today" flame.
  isRetroactive?: boolean;
}

export interface HealthStats {
  records: HealthRecord[];            // chronological: oldest → newest
  // 累計記録日数。連続が途切れてもリセットされない（挫折感を与えないため、
  // 連続日数ではなく積み上げ型のカウントを表示する）。
  totalDays: number;
  avgMood: number | null;             // last 7 days
  avgSleepHours: number | null;       // last 7 days
  totalAlcoholDays: number;           // within records
  symptomCounts: { label: string; count: number }[];
  appetiteCounts: Record<AppetiteValue, number>;
  avgSteps: number | null;
  avgActiveCalories: number | null;
  hasExerciseData: boolean;
}

// Shared storage key — future iOS widget will read the same value via
// App Groups + UserDefaults bridge.
const STREAK_CACHE_KEY = '@health_stats_cache_v1';

// --- Helpers ---
function todayString(): string {
  return dateToString(new Date());
}

function dateToString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offset);
  return dateToString(dt);
}

function avg(nums: number[]): number | null {
  if (!nums.length) { return null; }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function filterRecordsToCalendarWindow(
  records: HealthRecord[],
  days: number,
  today = todayString(),
): HealthRecord[] {
  const safeDays = Math.max(1, Math.floor(days));
  const start = addDays(today, -(safeDays - 1));
  return records.filter(r => r.date >= start && r.date <= today);
}

// --- Core ---

/**
 * 累計記録日数（生涯）を取得する。Firestore の集計クエリで全ドキュメント数を
 * 数える。失敗時は null（呼び出し側で読み込み済み件数にフォールバック）。
 */
export async function fetchTotalRecordedDays(uid: string): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collection(db, 'users', uid, 'healthRecords'));
    return snap.data().count;
  } catch {
    return null;
  }
}

export async function fetchHealthStats(uid: string, days = 30): Promise<HealthStats> {
  // Firestore: users/{uid}/healthRecords — doc id is the date string (YYYY-MM-DD),
  // and each record also stores the same value in `date`.
  const q = query(
    collection(db, 'users', uid, 'healthRecords'),
    orderBy('date', 'desc'),
    limit(days),
  );
  const snap = await getDocs(q);
  const records: HealthRecord[] = [];
  snap.forEach(d => records.push(d.data() as HealthRecord));

  // chronological order (oldest first) for charts
  records.reverse();
  const windowRecords = filterRecordsToCalendarWindow(records, days);

  // 炎の点灯（今日記録したか）は当日に記録した分だけを見る
  const onTimeDates = new Set(
    windowRecords.filter(r => r.isRetroactive !== true).map(r => r.date),
  );
  const totalDays = (await fetchTotalRecordedDays(uid)) ?? records.length;

  const last7 = windowRecords.slice(-7);

  const moods = last7.map(r => r.mood).filter((x): x is number => typeof x === 'number');
  const sleeps = last7.map(r => r.sleepHours).filter((x): x is number => typeof x === 'number' && x > 0);

  const totalAlcoholDays = windowRecords.filter(r => r.alcohol === true).length;

  // Symptom frequency across entire window
  const symMap = new Map<string, number>();
  windowRecords.forEach(r => {
    (r.symptoms ?? []).forEach(s => {
      symMap.set(s, (symMap.get(s) ?? 0) + 1);
    });
  });
  const symptomCounts = Array.from(symMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const appetiteCounts: Record<AppetiteValue, number> = {
    nothing: 0, water: 0, noodles: 0, set_meal: 0, steak: 0,
  };
  windowRecords.forEach(r => {
    if (r.appetite && appetiteCounts[r.appetite] !== undefined) {
      appetiteCounts[r.appetite] += 1;
    }
  });

  const stepsArr = windowRecords
    .map(r => r.steps)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  const calsArr = windowRecords
    .map(r => r.activeCalories)
    .filter((x): x is number => typeof x === 'number' && x > 0);

  const stats: HealthStats = {
    records: windowRecords,
    totalDays,
    avgMood: avg(moods),
    avgSleepHours: avg(sleeps),
    totalAlcoholDays,
    symptomCounts,
    appetiteCounts,
    avgSteps: avg(stepsArr),
    avgActiveCalories: avg(calsArr),
    hasExerciseData: stepsArr.length > 0 || calsArr.length > 0,
  };

  await cacheSummary(stats).catch(() => {});
  updateStreakWidget(totalDays, onTimeDates.has(todayString()));
  return stats;
}

/**
 * Persist a minimal summary for the iOS widget (future App Groups bridge).
 * Kept small and JSON-serialisable so migration to UserDefaults is trivial.
 */
async function cacheSummary(stats: HealthStats): Promise<void> {
  const payload = {
    totalDays: stats.totalDays,
    avgMood: stats.avgMood,
    avgSleepHours: stats.avgSleepHours,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(payload));
}

export async function readCachedSummary(): Promise<{ totalDays: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_CACHE_KEY);
    if (!raw) { return null; }
    const parsed = JSON.parse(raw);
    // 旧キャッシュ（streakキー）からの移行も受け付ける
    return { totalDays: parsed.totalDays ?? parsed.streak ?? 0 };
  } catch {
    return null;
  }
}
