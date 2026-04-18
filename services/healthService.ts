// Abstraction layer for HealthKit / Google Fit integration.
// Currently returns null values (no native library installed).
// To enable: add react-native-health (iOS) and replace this implementation.

export interface HealthKitData {
  sleepHours: number | null;
  steps: number | null;
  activeCalories: number | null;
}

export function isHealthKitAvailable(): boolean {
  return false;
}

export async function fetchTodayHealthKitData(): Promise<HealthKitData> {
  return { sleepHours: null, steps: null, activeCalories: null };
}
