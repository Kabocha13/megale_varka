import { HealthRecord } from '../services/statsService';
import {
  buildInterviewRetrospective,
  buildSupportAdvice,
  buildWeeklyPlan,
  collectUpcomingEvents,
  computeConditionSummary,
  conditionScoreOf,
  currentJobHuntPhase,
  dateToString,
  gradYearShortLabel,
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

describe('collectUpcomingEvents（次回面接日時フィールド）', () => {
  it('nextInterviewDate から面接イベントを生成する', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [], nextInterviewDate: daysFromToday(3), nextInterviewTime: '14:00' },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    expect(events).toHaveLength(1);
    expect(events[0].isInterview).toBe(true);
    expect(events[0].daysLeft).toBe(3);
    expect(events[0].time).toBe('14:00');
  });

  it('同日の面接タスクがあれば重複させない', () => {
    const companies: SupportCompany[] = [
      {
        id: 'a',
        name: 'A社',
        tasks: [{ id: 't', title: '一次面接', deadline: daysFromToday(3), completed: false }],
        nextInterviewDate: daysFromToday(3),
      },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('一次面接');
  });

  it('別日の面接タスクとは共存する', () => {
    const companies: SupportCompany[] = [
      {
        id: 'a',
        name: 'A社',
        tasks: [{ id: 't', title: '二次面接', deadline: daysFromToday(10), completed: false }],
        nextInterviewDate: daysFromToday(3),
      },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    expect(events).toHaveLength(2);
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
    expect(c.totalRecordedDays).toBe(0);
  });

  it('今日の記録と傾向を検出する', () => {
    const records: HealthRecord[] = [
      record({ date: daysFromToday(-2), sleepHours: 5, mood: 2 }),
      record({ date: daysFromToday(-1), sleepHours: 5.5, mood: 2 }),
      record({ date: TODAY, sleepHours: 5, mood: 3, appetite: 'set_meal' }),
    ];
    const c = computeConditionSummary(records, TODAY);
    expect(c.recordedToday).toBe(true);
    expect(c.shortSleepTrend).toBe(true);
    expect(c.lowMoodTrend).toBe(true);
    expect(c.lastSleepHours).toBe(5);
  });

  it('累計記録日数は連続が途切れても減らず、指定があればそれを使う', () => {
    const records: HealthRecord[] = [
      record({ date: daysFromToday(-5), isRetroactive: true }), // 間が空いていても
      record({ date: TODAY }),
    ];
    // 未指定ならウィンドウ内の記録数にフォールバック
    expect(computeConditionSummary(records, TODAY).totalRecordedDays).toBe(2);
    // 生涯累計（集計クエリの結果）が渡されればそれを使う
    expect(computeConditionSummary(records, TODAY, 42).totalRecordedDays).toBe(42);
  });
});

const GOOD_DAY: Partial<HealthRecord> = {
  appetite: 'steak', sleepHours: 8, mood: 5, symptoms: [], dailyAnswer: 'none',
};
const BAD_DAY: Partial<HealthRecord> = {
  appetite: 'nothing', sleepHours: 3, mood: 1, symptoms: ['頭痛', '腹痛'], dailyAnswer: 'always',
};

describe('buildWeeklyPlan', () => {
  // TODAY = 2026-07-03（金）。6/22・6/29 は月曜、6/21・6/28 は日曜。
  const records: HealthRecord[] = [
    record({ date: '2026-06-21', ...BAD_DAY }),
    record({ date: '2026-06-22', ...GOOD_DAY }),
    record({ date: '2026-06-28', ...BAD_DAY }),
    record({ date: '2026-06-29', ...GOOD_DAY }),
  ];

  it('締切はその日の予定（busy）にせず、締切マーカーとして数える', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [{ id: 't', title: 'ES提出', deadline: daysFromToday(1), completed: false }] },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    const plan = buildWeeklyPlan(records, events, TODAY);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[1].kind).not.toBe('busy');
    expect(plan.days[1].deadlineCount).toBe(1);
    expect(plan.days[1].interviewCount).toBe(0);
    expect(plan.weekDeadlineCount).toBe(1);
  });

  it('面接のある日は busy になる', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [{ id: 't', title: '一次面接', deadline: daysFromToday(1), completed: false }] },
    ];
    const events = collectUpcomingEvents(companies, TODAY);
    const plan = buildWeeklyPlan(records, events, TODAY);
    expect(plan.days[1].kind).toBe('busy');
    expect(plan.days[1].interviewCount).toBe(1);
    expect(plan.days[1].deadlineCount).toBe(0);
  });

  it('曜日傾向から作業おすすめ日・休息日を判定し、おすすめ日を返す', () => {
    const plan = buildWeeklyPlan(records, [], TODAY);
    const monday = plan.days.find(d => d.weekday === 1)!;
    const sunday = plan.days.find(d => d.weekday === 0)!;
    expect(monday.kind).toBe('work');
    expect(monday.tendency).toBe(100);
    expect(sunday.kind).toBe('rest');
    expect(plan.recommendedDate).toBe(monday.date);
  });

  it('記録がなければ傾向は null で normal になる', () => {
    const plan = buildWeeklyPlan([], [], TODAY);
    expect(plan.days.every(d => d.kind === 'normal' && d.tendency === null)).toBe(true);
    expect(plan.recommendedDate).toBeNull();
  });
});

describe('buildInterviewRetrospective', () => {
  it('過去の面接タスクと当日の体調記録を突き合わせる', () => {
    const companies: SupportCompany[] = [
      {
        id: 'a',
        name: 'A社',
        selectionStatus: '一次面接済',
        tasks: [{ id: 't', title: '一次面接', deadline: daysFromToday(-2), completed: true }],
      },
    ];
    const records = [record({ date: daysFromToday(-2), ...GOOD_DAY })];
    const items = buildInterviewRetrospective(companies, records, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0].conditionScore).toBe(conditionScoreOf(records[0]));
    expect(items[0].selectionStatus).toBe('一次面接済');
  });

  it('未来の面接と記録なしの日を正しく扱う', () => {
    const companies: SupportCompany[] = [
      {
        id: 'a',
        name: 'A社',
        tasks: [
          { id: 't1', title: '最終面接', deadline: daysFromToday(2), completed: false },
          { id: 't2', title: '二次面接', deadline: daysFromToday(-5), completed: true },
        ],
      },
    ];
    const items = buildInterviewRetrospective(companies, [], TODAY);
    expect(items).toHaveLength(1); // 未来の面接は含まない
    expect(items[0].title).toBe('二次面接');
    expect(items[0].conditionScore).toBeNull();
  });

  it('nextInterviewDate が過去なら振り返りに含め、新しい順に並べる', () => {
    const companies: SupportCompany[] = [
      { id: 'a', name: 'A社', tasks: [], nextInterviewDate: daysFromToday(-1) },
      {
        id: 'b',
        name: 'B社',
        tasks: [{ id: 't', title: 'GD選考', deadline: daysFromToday(-3), completed: true }],
      },
    ];
    const items = buildInterviewRetrospective(companies, [], TODAY);
    expect(items.map(i => i.companyName)).toEqual(['A社', 'B社']);
  });
});

describe('currentJobHuntPhase / gradYearShortLabel', () => {
  it('27卒の標準スケジュールを判定する', () => {
    expect(currentJobHuntPhase(2027, '2025-05-01')?.key).toBe('early');
    expect(currentJobHuntPhase(2027, '2025-06-01')?.key).toBe('summer_intern');
    expect(currentJobHuntPhase(2027, '2025-10-01')?.key).toBe('autumn_winter');
    expect(currentJobHuntPhase(2027, '2026-03-01')?.key).toBe('entry_rush');
    expect(currentJobHuntPhase(2027, '2026-06-01')?.key).toBe('selection');
    expect(currentJobHuntPhase(2027, '2026-10-01')?.key).toBe('offer_period');
    expect(currentJobHuntPhase(2027, '2027-03-31')?.key).toBe('offer_period');
    expect(currentJobHuntPhase(2027, '2027-04-01')).toBeNull(); // 卒業後
  });

  it('短縮表記を返す', () => {
    expect(gradYearShortLabel(2027)).toBe('27卒');
    expect(gradYearShortLabel(2030)).toBe('30卒');
  });

  it('フェーズを渡すとアドバイスに含まれる', () => {
    const condition = computeConditionSummary([], TODAY);
    const phase = currentJobHuntPhase(2028, TODAY); // 2026-07-03 → サマーインターン期
    expect(phase?.key).toBe('summer_intern');
    const advice = buildSupportAdvice(condition, [], [], 10, phase);
    expect(advice.some(a => a.id === 'phase-summer_intern')).toBe(true);
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
