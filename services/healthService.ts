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

const EMPTY: HealthKitData = { sleepHours: null, steps: null, activeCalories: null };

// Silently fetches yesterday's data; won't show permission dialog. Call on mount.
export async function fetchYesterdayHealthKitData(): Promise<HealthKitData> {
  if (!isHealthKitAvailable()) { return EMPTY; }
  const asked = await hasRequestedHealthKit();
  if (!asked) { return EMPTY; }

  const now = new Date();

  // Yesterday: 00:00 → 23:59:59
  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date(startOfYesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  // Sleep window: 2 days ago 16:00 → yesterday 12:00 (captures overnight sleep)
  const sleepEnd = new Date(startOfYesterday);
  sleepEnd.setHours(12, 0, 0, 0);
  const sleepStart = new Date(sleepEnd.getTime() - 20 * 60 * 60 * 1000);

  const [sleepResult, stepsResult, caloriesResult] = await Promise.allSettled([
    getSleepHours(sleepStart, sleepEnd),
    getStepCount(startOfYesterday, endOfYesterday),
    getActiveCalories(startOfYesterday, endOfYesterday),
  ]);

  return {
    sleepHours: sleepResult.status === 'fulfilled' ? sleepResult.value : null,
    steps: stepsResult.status === 'fulfilled' ? stepsResult.value : null,
    activeCalories: caloriesResult.status === 'fulfilled' ? caloriesResult.value : null,
  };
}

// HealthKit sleep values: 0=inBed, 1=asleep(legacy), 2=awake, 3=asleepCore, 4=asleepDeep, 5=asleepREM
const SLEEP_VALUES = new Set([1, 3, 4, 5]);

async function getSleepHours(startDate: Date, endDate: Date): Promise<number | null> {
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: { date: { startDate, endDate } },
    limit: 1000,
  });
  if (!samples.length) { return null; }
  let ms = 0;
  for (const s of samples) {
    if (SLEEP_VALUES.has(s.value as number)) {
      ms += s.endDate.getTime() - s.startDate.getTime();
    }
  }
  return ms > 0 ? ms / 3_600_000 : null;
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
