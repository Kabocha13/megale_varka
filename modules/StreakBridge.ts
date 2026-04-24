import { NativeModules, Platform } from 'react-native';

const { StreakBridgeModule } = NativeModules;

/**
 * Push streak state to the native home-screen widget.
 * No-ops gracefully when the native module is unavailable (e.g. simulators
 * without widget support, or during Jest tests).
 */
export function updateStreakWidget(streak: number, recordedToday: boolean): void {
  if (Platform.OS === 'web') { return; }
  StreakBridgeModule?.update?.(streak, recordedToday);
}
