import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
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
  // Retroactive entries are included in charts but excluded from the streak.
  isRetroactive?: boolean;
}

export interface HealthStats {
  records: HealthRecord[];            // chronological: oldest → newest
  streak: number;                     // consecutive days up to today
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function avg(nums: number[]): number | null {
  if (!nums.length) { return null; }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// --- Core ---

/**
 * Compute consecutive recording days ending at today (or yesterday if today
 * hasn't been recorded yet — so users don't "break" the streak by not having
 * recorded yet for the current day).
 */
export function computeStreak(recordDates: Set<string>): number {
  const today = todayString();
  let cursor = recordDates.has(today) ? today : yesterdayString();
  if (!recordDates.has(cursor)) { return 0; }
  let count = 0;
  while (recordDates.has(cursor)) {
    count += 1;
    cursor = prevDate(cursor);
  }
  return count;
}

export async function fetchHealthStats(uid: string, days = 30): Promise<HealthStats> {
  // Firestore: users/{uid}/healthRecords — doc id is the date string (YYYY-MM-DD),
  // so ordering by __name__ desc gives us the most recent records first.
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

  // Streak only counts records made on the actual day (not retroactive).
  const onTimeDates = new Set(
    records.filter(r => r.isRetroactive !== true).map(r => r.date),
  );
  const streak = computeStreak(onTimeDates);

  const last7 = records.slice(-7);

  const moods = last7.map(r => r.mood).filter((x): x is number => typeof x === 'number');
  const sleeps = last7.map(r => r.sleepHours).filter((x): x is number => typeof x === 'number' && x > 0);

  const totalAlcoholDays = records.filter(r => r.alcohol === true).length;

  // Symptom frequency across entire window
  const symMap = new Map<string, number>();
  records.forEach(r => {
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
  records.forEach(r => {
    if (r.appetite && appetiteCounts[r.appetite] !== undefined) {
      appetiteCounts[r.appetite] += 1;
    }
  });

  const stepsArr = records
    .map(r => r.steps)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  const calsArr = records
    .map(r => r.activeCalories)
    .filter((x): x is number => typeof x === 'number' && x > 0);

  const stats: HealthStats = {
    records,
    streak,
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
  updateStreakWidget(streak, onTimeDates.has(todayString()));
  return stats;
}

/**
 * Persist a minimal summary for the iOS widget (future App Groups bridge).
 * Kept small and JSON-serialisable so migration to UserDefaults is trivial.
 */
async function cacheSummary(stats: HealthStats): Promise<void> {
  const payload = {
    streak: stats.streak,
    avgMood: stats.avgMood,
    avgSleepHours: stats.avgSleepHours,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(payload));
}

export async function readCachedSummary(): Promise<{ streak: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_CACHE_KEY);
    if (!raw) { return null; }
    const parsed = JSON.parse(raw);
    return { streak: parsed.streak ?? 0 };
  } catch {
    return null;
  }
}
