import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

export interface HealthKitData {
  sleepHours: number | null;
  sleepStart: Date | null;     // earliest "asleep" sample start within the window
  sleepEnd: Date | null;       // latest "asleep" sample end within the window
  steps: number | null;
  activeCalories: number | null;
}

const HK_ASKED_KEY = '@hk_permission_asked';

const READ_PERMISSIONS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') { return false; }
  try { return isHealthDataAvailable(); } catch { return false; }
}

export async function hasRequestedHealthKit(): Promise<boolean> {
  const val = await AsyncStorage.getItem(HK_ASKED_KEY).catch(() => null);
  return val === 'true';
}

export type HKRequestResult = { ok: true } | { ok: false };

// Shows the HealthKit permission dialog. Safe to call repeatedly — iOS only shows once.
export async function requestHealthKitPermissions(): Promise<HKRequestResult> {
  if (!isHealthKitAvailable()) { return { ok: false }; }
  try {
    await requestAuthorization({ toRead: READ_PERMISSIONS });
    await AsyncStorage.setItem(HK_ASKED_KEY, 'true');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

const EMPTY: HealthKitData = {
  sleepHours: null,
  sleepStart: null,
  sleepEnd: null,
  steps: null,
  activeCalories: null,
};

// Silently fetches yesterday's data; won't show permission dialog. Call on mount.
export async function fetchYesterdayHealthKitData(): Promise<HealthKitData> {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const dateStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return fetchHealthKitDataForDate(dateStr);
}

/**
 * Fetches HealthKit data for an arbitrary calendar day (YYYY-MM-DD).
 * Silent — no permission dialog. Used by the retroactive-entry flow so
 * past-day forms still show the day's steps / calories / sleep.
 */
export async function fetchHealthKitDataForDate(dateStr: string): Promise<HealthKitData> {
  if (!isHealthKitAvailable()) { return EMPTY; }
  const asked = await hasRequestedHealthKit();
  if (!asked) { return EMPTY; }

  const [y, m, d] = dateStr.split('-').map(Number);
  // Steps / calories window: the full target day 00:00 → 23:59:59
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  // Sleep window: the previous day 12:00 → target day 18:00. Wide enough to
  // catch early bedtimes and wake-ups past noon, but ends before the target
  // day's own night so retroactive entries don't pick up the following night.
  // The main sleep session inside the window is selected by
  // pickMainSleepSession, so evening naps no longer skew bed/wake times.
  const sleepWindowStart = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  const sleepWindowEnd = new Date(y, m - 1, d, 18, 0, 0, 0);

  const [sleepResult, stepsResult, caloriesResult] = await Promise.allSettled([
    getSleepInfo(sleepWindowStart, sleepWindowEnd, dayStart),
    getStepCount(dayStart, dayEnd),
    getActiveCalories(dayStart, dayEnd),
  ]);

  const sleepInfo = sleepResult.status === 'fulfilled' ? sleepResult.value : null;
  return {
    sleepHours: sleepInfo?.hours ?? null,
    sleepStart: sleepInfo?.startDate ?? null,
    sleepEnd: sleepInfo?.endDate ?? null,
    steps: stepsResult.status === 'fulfilled' ? stepsResult.value : null,
    activeCalories: caloriesResult.status === 'fulfilled' ? caloriesResult.value : null,
  };
}

// HealthKit sleep values: 0=inBed, 1=asleep(legacy), 2=awake, 3=asleepCore, 4=asleepDeep, 5=asleepREM
const SLEEP_VALUES = new Set([1, 3, 4, 5]);

// Asleep samples separated by a gap of at least this long belong to
// different sleep sessions (e.g. an evening nap vs. the overnight sleep).
const SESSION_GAP_MS = 90 * 60 * 1000;

export interface SleepSample {
  startDate: Date;
  endDate: Date;
  value: number;
}

interface SleepInfo {
  hours: number;     // actual asleep time within the main session
  startDate: Date;   // main session start (bed time)
  endDate: Date;     // main session end (wake time)
}

/**
 * Picks the main sleep session for the day starting at `dayStart` from raw
 * HealthKit sleep samples.
 *
 * Overlapping samples (e.g. iPhone and Apple Watch both recording) are merged
 * so time isn't double-counted, then the merged intervals are grouped into
 * sessions wherever the awake gap is >= 90 minutes. Sessions that end on the
 * target day are preferred (the overnight sleep the record is about); among
 * those the longest wins. If no session ends on the target day, the longest
 * session overall is used.
 */
export function pickMainSleepSession(
  samples: SleepSample[],
  dayStart: Date,
): SleepInfo | null {
  const intervals = samples
    .filter(s =>
      SLEEP_VALUES.has(s.value) &&
      s.endDate.getTime() > s.startDate.getTime(),
    )
    .map(s => ({ start: s.startDate.getTime(), end: s.endDate.getTime() }))
    .sort((a, b) => a.start - b.start);
  if (!intervals.length) { return null; }

  // Merge overlaps (multi-source dedup), splitting into sessions at big gaps.
  interface Session { start: number; end: number; asleepMs: number }
  const sessions: Session[] = [];
  let cur: Session | null = null;
  let curIntervalEnd = 0;
  for (const iv of intervals) {
    if (cur && iv.start - curIntervalEnd < SESSION_GAP_MS) {
      const overlap = Math.max(0, curIntervalEnd - iv.start);
      cur.asleepMs += Math.max(0, iv.end - iv.start - overlap);
      cur.end = Math.max(cur.end, iv.end);
      curIntervalEnd = Math.max(curIntervalEnd, iv.end);
    } else {
      cur = { start: iv.start, end: iv.end, asleepMs: iv.end - iv.start };
      sessions.push(cur);
      curIntervalEnd = iv.end;
    }
  }

  const endsOnDay = sessions.filter(s => s.end >= dayStart.getTime());
  const candidates = endsOnDay.length ? endsOnDay : sessions;
  const main = candidates.reduce((a, b) => (b.asleepMs > a.asleepMs ? b : a));
  if (main.asleepMs <= 0) { return null; }
  return {
    hours: main.asleepMs / 3_600_000,
    startDate: new Date(main.start),
    endDate: new Date(main.end),
  };
}

async function getSleepInfo(
  startDate: Date,
  endDate: Date,
  dayStart: Date,
): Promise<SleepInfo | null> {
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: { date: { startDate, endDate } },
    limit: 1000,
  });
  return pickMainSleepSession(
    samples.map(s => ({
      startDate: s.startDate,
      endDate: s.endDate,
      value: s.value as number,
    })),
    dayStart,
  );
}

async function getStepCount(startDate: Date, endDate: Date): Promise<number | null> {
  const stats = await queryStatisticsForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    { filter: { date: { startDate, endDate } }, unit: 'count' },
  );
  const sum = stats?.sumQuantity?.quantity;
  return typeof sum === 'number' ? Math.round(sum) : null;
}

async function getActiveCalories(startDate: Date, endDate: Date): Promise<number | null> {
  const stats = await queryStatisticsForQuantity(
    'HKQuantityTypeIdentifierActiveEnergyBurned',
    ['cumulativeSum'],
    { filter: { date: { startDate, endDate } }, unit: 'kcal' },
  );
  const sum = stats?.sumQuantity?.quantity;
  return typeof sum === 'number' ? Math.round(sum) : null;
}
