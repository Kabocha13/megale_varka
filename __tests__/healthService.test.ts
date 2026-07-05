import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isHealthDataAvailable,
  queryCategorySamples,
} from '@kingstinct/react-native-healthkit';
import {
  fetchHealthKitDataForDate,
  pickMainSleepSession,
  SleepSample,
} from '../services/healthService';

jest.mock('firebase/firestore', () => ({}));
jest.mock('../firebase/config', () => ({ db: {} }));

// value 3 = asleepCore
function asleep(start: string, end: string, value = 3): SleepSample {
  return { startDate: new Date(start), endDate: new Date(end), value };
}

// Target day for all tests: 2026-07-05 (dayStart = midnight)
const DAY_START = new Date('2026-07-05T00:00:00');

describe('pickMainSleepSession', () => {
  it('returns null when there are no samples', () => {
    expect(pickMainSleepSession([], DAY_START)).toBeNull();
  });

  it('ignores inBed / awake samples', () => {
    const samples = [
      asleep('2026-07-04T23:00:00', '2026-07-05T07:00:00', 0), // inBed
      asleep('2026-07-05T02:00:00', '2026-07-05T02:30:00', 2), // awake
    ];
    expect(pickMainSleepSession(samples, DAY_START)).toBeNull();
  });

  it('returns the overnight sleep as-is', () => {
    const info = pickMainSleepSession(
      [asleep('2026-07-04T23:00:00', '2026-07-05T07:00:00')],
      DAY_START,
    );
    expect(info).not.toBeNull();
    expect(info!.startDate).toEqual(new Date('2026-07-04T23:00:00'));
    expect(info!.endDate).toEqual(new Date('2026-07-05T07:00:00'));
    expect(info!.hours).toBeCloseTo(8);
  });

  it('excludes a previous-evening nap from bed/wake times', () => {
    const samples = [
      asleep('2026-07-04T17:00:00', '2026-07-04T18:00:00'), // nap
      asleep('2026-07-04T23:30:00', '2026-07-05T06:30:00'), // main sleep
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.startDate).toEqual(new Date('2026-07-04T23:30:00'));
    expect(info.endDate).toEqual(new Date('2026-07-05T06:30:00'));
    expect(info.hours).toBeCloseTo(7);
  });

  it('prefers the session ending on the target day over a longer previous-day one', () => {
    const samples = [
      asleep('2026-07-04T13:00:00', '2026-07-04T21:00:00'), // long daytime sleep yesterday
      asleep('2026-07-05T01:00:00', '2026-07-05T06:00:00'), // last night
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.startDate).toEqual(new Date('2026-07-05T01:00:00'));
    expect(info.endDate).toEqual(new Date('2026-07-05T06:00:00'));
  });

  it('falls back to the longest session when none ends on the target day', () => {
    const samples = [
      asleep('2026-07-04T14:00:00', '2026-07-04T15:00:00'),
      asleep('2026-07-04T18:00:00', '2026-07-04T23:00:00'),
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.startDate).toEqual(new Date('2026-07-04T18:00:00'));
    expect(info.endDate).toEqual(new Date('2026-07-04T23:00:00'));
  });

  it('handles a wake-up after noon (previously cut off at 12:00)', () => {
    const info = pickMainSleepSession(
      [asleep('2026-07-05T04:00:00', '2026-07-05T13:00:00')],
      DAY_START,
    )!;
    expect(info.endDate).toEqual(new Date('2026-07-05T13:00:00'));
    expect(info.hours).toBeCloseTo(9);
  });

  it('keeps sleep stages separated by short awake gaps in one session', () => {
    const samples = [
      asleep('2026-07-04T23:00:00', '2026-07-05T01:00:00'),
      asleep('2026-07-05T02:00:00', '2026-07-05T07:00:00'), // 1h awake gap < 90min
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.startDate).toEqual(new Date('2026-07-04T23:00:00'));
    expect(info.endDate).toEqual(new Date('2026-07-05T07:00:00'));
    expect(info.hours).toBeCloseTo(7); // awake hour not counted as sleep
  });

  it('does not double-count overlapping samples from two sources', () => {
    const samples = [
      asleep('2026-07-04T23:00:00', '2026-07-05T07:00:00'), // Apple Watch
      asleep('2026-07-04T23:10:00', '2026-07-05T06:50:00', 1), // iPhone (legacy asleep)
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.hours).toBeCloseTo(8);
    expect(info.startDate).toEqual(new Date('2026-07-04T23:00:00'));
    expect(info.endDate).toEqual(new Date('2026-07-05T07:00:00'));
  });

  it('picks a shorter nap over nothing when it is the only session on the day', () => {
    const samples = [
      asleep('2026-07-05T13:30:00', '2026-07-05T14:00:00'),
    ];
    const info = pickMainSleepSession(samples, DAY_START)!;
    expect(info.hours).toBeCloseTo(0.5);
  });
});

describe('fetchHealthKitDataForDate sleep window', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (isHealthDataAvailable as jest.Mock).mockReturnValue(true);
    await AsyncStorage.setItem('@hk_permission_asked', 'true');
  });

  it('queries sleep from previous day 12:00 to target day 18:00', async () => {
    await fetchHealthKitDataForDate('2026-07-05');
    const sleepCall = (queryCategorySamples as jest.Mock).mock.calls.find(
      ([type]) => type === 'HKCategoryTypeIdentifierSleepAnalysis',
    );
    expect(sleepCall).toBeDefined();
    const { startDate, endDate } = sleepCall![1].filter.date;
    expect(startDate).toEqual(new Date(2026, 6, 4, 12, 0, 0, 0));
    expect(endDate).toEqual(new Date(2026, 6, 5, 18, 0, 0, 0));
  });

  it('rolls the window start over month boundaries', async () => {
    await fetchHealthKitDataForDate('2026-07-01');
    const sleepCall = (queryCategorySamples as jest.Mock).mock.calls.find(
      ([type]) => type === 'HKCategoryTypeIdentifierSleepAnalysis',
    );
    const { startDate } = sleepCall![1].filter.date;
    expect(startDate).toEqual(new Date(2026, 5, 30, 12, 0, 0, 0));
  });
});
