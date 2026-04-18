import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import { Platform } from 'react-native';

export interface HealthKitData {
  sleepHours: number | null;
  steps: number | null;
  activeCalories: number | null;
}

const HK_ASKED_KEY = '@hk_permission_asked';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
};

function initHealthKit(): Promise<void> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
      if (error) { reject(new Error(error)); }
      else { resolve(); }
    });
  });
}

export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}

export async function hasRequestedHealthKit(): Promise<boolean> {
  const val = await AsyncStorage.getItem(HK_ASKED_KEY).catch(() => null);
  return val === 'true';
}

export type HKRequestResult = 'granted' | 'unavailable';

// Shows the HealthKit permission dialog (call only when user explicitly requests)
export async function requestHealthKitPermissions(): Promise<HKRequestResult> {
  if (!isHealthKitAvailable()) { return 'unavailable'; }
  try {
    await initHealthKit();
    await AsyncStorage.setItem(HK_ASKED_KEY, 'true');
    return 'granted';
  } catch {
    // initHealthKit throws only when HealthKit itself is unavailable
    // (iOS Simulator, MDM-restricted device, etc.)
    // User denying the permission dialog does NOT cause an error.
    return 'unavailable';
  }
}

const EMPTY: HealthKitData = { sleepHours: null, steps: null, activeCalories: null };

// Silently fetches data; won't show permission dialog (call on mount)
export async function fetchTodayHealthKitData(): Promise<HealthKitData> {
  if (!isHealthKitAvailable()) { return EMPTY; }
  const asked = await hasRequestedHealthKit();
  if (!asked) { return EMPTY; }

  try {
    await initHealthKit();
  } catch {
    return EMPTY;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Sleep window: yesterday 16:00 → today 12:00 (captures overnight sleep)
  const sleepEnd = new Date(now);
  sleepEnd.setHours(12, 0, 0, 0);
  const sleepStart = new Date(sleepEnd.getTime() - 20 * 60 * 60 * 1000);

  const [sleepResult, stepsResult, caloriesResult] = await Promise.allSettled([
    getSleepHours(sleepStart, sleepEnd),
    getStepCount(startOfDay, now),
    getActiveCalories(startOfDay, now),
  ]);

  return {
    sleepHours: sleepResult.status === 'fulfilled' ? sleepResult.value : null,
    steps: stepsResult.status === 'fulfilled' ? stepsResult.value : null,
    activeCalories: caloriesResult.status === 'fulfilled' ? caloriesResult.value : null,
  };
}

// HealthKit sleep values: 0=inBed, 1=asleep, 2=awake, 3=asleepCore, 4=asleepDeep, 5=asleepREM
const SLEEP_VALUES = new Set([1, 3, 4, 5]);

function getSleepHours(startDate: Date, endDate: Date): Promise<number | null> {
  return new Promise((resolve) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    AppleHealthKit.getSleepSamples(options, (err, results) => {
      if (err || !results?.length) { resolve(null); return; }
      let ms = 0;
      for (const s of results as HealthValue[]) {
        if (SLEEP_VALUES.has(s.value)) {
          ms += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        }
      }
      resolve(ms > 0 ? ms / 3_600_000 : null);
    });
  });
}

function getStepCount(startDate: Date, endDate: Date): Promise<number | null> {
  return new Promise((resolve) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      includeManuallyAdded: false,
    };
    AppleHealthKit.getStepCount(options, (err, result) => {
      if (err || result == null) { resolve(null); return; }
      resolve(Math.round((result as HealthValue).value ?? 0));
    });
  });
}

function getActiveCalories(startDate: Date, endDate: Date): Promise<number | null> {
  return new Promise((resolve) => {
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      includeManuallyAdded: false,
    };
    AppleHealthKit.getActiveEnergyBurned(options, (err, results) => {
      if (err || !results?.length) { resolve(null); return; }
      resolve(Math.round(results.reduce((sum, r) => sum + (r.value ?? 0), 0)));
    });
  });
}
