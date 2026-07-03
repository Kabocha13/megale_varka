import { filterRecordsToCalendarWindow, HealthRecord } from '../services/statsService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../firebase/config', () => ({
  db: {},
}));

jest.mock('../modules/StreakBridge', () => ({
  updateStreakWidget: jest.fn(),
}));

function record(date: string, overrides: Partial<HealthRecord> = {}): HealthRecord {
  return { date, ...overrides };
}

describe('filterRecordsToCalendarWindow', () => {
  it('直近N件ではなく直近N暦日の記録だけを返す', () => {
    const records: HealthRecord[] = [
      record('2026-06-03', { alcohol: true, appetite: 'steak' }),
      record('2026-06-04', { alcohol: true, appetite: 'set_meal' }),
      record('2026-06-20', { alcohol: false, appetite: 'noodles' }),
      record('2026-07-03', { alcohol: true, appetite: 'water' }),
      record('2026-07-04', { alcohol: true, appetite: 'nothing' }),
    ];

    const windowed = filterRecordsToCalendarWindow(records, 30, '2026-07-03');

    expect(windowed.map(r => r.date)).toEqual([
      '2026-06-04',
      '2026-06-20',
      '2026-07-03',
    ]);
  });
});
