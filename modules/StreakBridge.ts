import { NativeModules, Platform } from 'react-native';

const { StreakBridgeModule } = NativeModules;

/**
 * Push recording state to the native home-screen widget.
 * totalDays is the cumulative number of recorded days (never resets);
 * recordedToday lights the flame. The native storage key is still "streak"
 * for backwards compatibility with installed widgets.
 * No-ops gracefully when the native module is unavailable (e.g. simulators
 * without widget support, or during Jest tests).
 */
export function updateStreakWidget(totalDays: number, recordedToday: boolean): void {
  if (Platform.OS === 'web') { return; }
  StreakBridgeModule?.update?.(totalDays, recordedToday);
}
