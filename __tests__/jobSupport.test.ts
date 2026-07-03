import { HealthRecord } from '../services/statsService';
import {
  buildSupportAdvice,
  collectUpcomingEvents,
  computeConditionSummary,
  dateToString,
  scoreMental,
  scoreStamina,
  SupportCompany,
} from '../services/jobSupport';

const TODAY = '2026-07-03';

function daysFromToday(offset: number): string {
  const d = new Date(2026, 6, 3);
  d.setDate(d.getDate() + offset);
  return dateToString(d);
}

function record(overrides: Partial<HealthRecord>): HealthRecord {
  return { date: TODAY, ...overrides };
}

describe('collectUpcomingEvents', () => {
  const companies: SupportCompany[] = [
    {
      id: 'a',
      name: 'A社',
      tasks: [
        { id: 't1', title: '一次面接', deadline: daysFromToday(2), time: '10:00', completed: false },
        { id: 't2', title: 'ES提出', deadline: daysFromToday(1), time: '23:59', completed: false },
        { id: 't3', title: '完了済み', deadline: daysFromToday(3), completed: true },
        { id: 't4', title: '遠い予定', deadline: daysFromToday(30), completed: false },
      ],
    },
    {
      id: 'b',
      name: 'B社',
      tasks: [
        { id: 't5', title: '書類提出', deadline: daysFromToday(-2), completed: false },
        { id: 't6', title: '大昔のタスク', deadline: daysFromToday(-30), completed: false },
        { id: 't7', title: '日付なし', deadline: '', completed: false },
      ],
    },
  ];

  it('期限内の未完了タスクだけを日付順に返す', () => {
    const events = collectUpcomingEvents(companies, TODAY);
    expect(events.map(e => e.title)).toEqual(['書類提出', 'ES提出', '一次面接']);
  });

  it('daysLeft と面接判定を計算する', () => {
    const events = collectUpcomingEvents(companies, TODAY);
    const interview = events.find(e => e.title === '一次面接')!;
    expect(interview.daysLeft).toBe(2);
    expect(interview.isInterview).toBe(true);
    const overdue = events.find(e => e.title === '書類提出')!;
    expect(overdue.daysLeft).toBe(-2);
    expect(overdue.isInterview).toBe(false);
  });
});

describe('scoreStamina / scoreMental', () => {
  it('良い記録は高スコアになる', () => {
    const r = record({ appetite: 'steak', sleepHours: 8.5, mood: 5, symptoms: [], dailyAnswer: 'none' });
    expect(scoreStamina(r)).toBe(100);
    expect(scoreMental(r)).toBe(100);
  });

  it('悪い記録は低スコアになる', () => {
    const r = record({ appetite: 'nothing', sleepHours: 3, mood: 1, symptoms: ['頭痛', '腹痛'], dailyAnswer: 'always' });
    expect(scoreStamina(r)).toBe(0);
    expect(scoreMental(r)).toBe(0);
  });
});

describe('computeConditionSummary', () => {
  it('記録なしでは null スコアを返す', () => {
    const c = computeConditionSummary([], TODAY);
    expect(c.stamina).toBeNull();
    expect(c.mental).toBeNull();
    expect(c.recordedToday).toBe(false);
    expect(c.streak).toBe(0);
  });

  it('今日の記録と傾向・連続日数を検出する', () => {
    const records: HealthRecord[] = [
      record({ date: daysFromToday(-2), sleepHours: 5, mood: 2 }),
      record({ date: daysFromToday(-1), sleepHours: 5.5, mood: 2 }),
      record({ date: TODAY, sleepHours: 5, mood: 3, appetite: 'set_meal' }),
    ];
    const c = computeConditionSummary(records, TODAY);
    expect(c.recordedToday).toBe(true);
    expect(c.shortSleepTrend).toBe(true);
    expect(c.lowMoodTrend).toBe(true);
    expect(c.streak).toBe(3);
    expect(c.lastSleepHours).toBe(5);
  });

  it('遡り記録はストリークに数えない', () => {
    const records: HealthRecord[] = [
      record({ date: daysFromToday(-1), isRetroactive: true }),
      record({ date: TODAY }),
    ];
    const c = computeConditionSummary(records, TODAY);
    expect(c.streak).toBe(1);
  });
});

describe('buildSupportAdvice', () => {
  const goodCondition = computeConditionSummary(
    [record({ appetite: 'steak', sleepHours: 8, mood: 5, symptoms: [], dailyAnswer: 'none' })],
    TODAY,
  );

  it('面接直前の睡眠不足には警告を出す', () => {
    const condition = computeConditionSummary(
      [
        record({ date: daysFromToday(-2), sleepHours: 5, mood: 4 }),
        record({ date: daysFromToday(-1), sleepHours: 5, mood: 4 }),
        record({ date: TODAY, sleepHours: 5, mood: 4, appetite: 'set_meal' }),
      ],
      TODAY,
    );
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [{ id: 't', title: '一次面接', deadline: daysFromToday(1), completed: false }] },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    const advice = buildSupportAdvice(condition, events, companies);
    expect(advice.some(a => a.id === 'interview-sleep')).toBe(true);
    expect(advice[0].tone).toBe('warning'); // warnings sort first
  });

  it('好調でES下書きがあれば推敲を提案する', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', entrySheet: { status: '下書き' }, tasks: [] },
    ];
    const advice = buildSupportAdvice(goodCondition, [], companies);
    expect(advice.some(a => a.id === 'es-chance')).toBe(true);
  });

  it('期限超過タスクを警告する', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [{ id: 't', title: 'ES提出', deadline: daysFromToday(-1), completed: false }] },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    const advice = buildSupportAdvice(goodCondition, events, companies);
    expect(advice.some(a => a.id === 'overdue')).toBe(true);
  });

  it('今日の記録がなければ記録を促す', () => {
    const condition = computeConditionSummary([record({ date: daysFromToday(-1) })], TODAY);
    const advice = buildSupportAdvice(condition, [], []);
    expect(advice.some(a => a.id === 'record-today')).toBe(true);
  });

  it('内定があれば祝福する', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', selectionStatus: '内定', tasks: [] },
    ];
    const advice = buildSupportAdvice(goodCondition, [], companies);
    expect(advice.some(a => a.id === 'offer')).toBe(true);
  });

  it('最大件数を超えない', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', selectionStatus: '内定', entrySheet: { status: '下書き' }, tasks: [] },
    ];
    const advice = buildSupportAdvice(goodCondition, [], companies, 2);
    expect(advice.length).toBeLessThanOrEqual(2);
  });
});
