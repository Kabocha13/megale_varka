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

  // Sleep window: the previous day 16:00 → target day 12:00
  // (captures the overnight sleep that ended on the morning of the target day)
  const sleepEnd = new Date(y, m - 1, d, 12, 0, 0, 0);
  const sleepStart = new Date(sleepEnd.getTime() - 20 * 60 * 60 * 1000);

  const [sleepResult, stepsResult, caloriesResult] = await Promise.allSettled([
    getSleepInfo(sleepStart, sleepEnd),
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

interface SleepInfo {
  hours: number;
  startDate: Date;   // earliest "asleep" sample start
  endDate: Date;     // latest "asleep" sample end
}

async function getSleepInfo(startDate: Date, endDate: Date): Promise<SleepInfo | null> {
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: { date: { startDate, endDate } },
    limit: 1000,
  });
  if (!samples.length) { return null; }
  let ms = 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const s of samples) {
    if (!SLEEP_VALUES.has(s.value as number)) { continue; }
    ms += s.endDate.getTime() - s.startDate.getTime();
    if (!earliest || s.startDate.getTime() < earliest.getTime()) {
      earliest = s.startDate;
    }
    if (!latest || s.endDate.getTime() > latest.getTime()) {
      latest = s.endDate;
    }
  }
  if (ms <= 0 || !earliest || !latest) { return null; }
  return { hours: ms / 3_600_000, startDate: earliest, endDate: latest };
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
