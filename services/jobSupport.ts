import { HealthRecord } from './statsService';
import { JobProgressCompany } from './jobSearchProgress';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupportTask {
  id?: string;
  title?: string;
  deadline?: string; // YYYY-MM-DD
  time?: string;     // HH:mm
  completed?: boolean;
}

export interface SupportESQA {
  question?: string;
  answer?: string;
  charLimit?: number;
}

export interface SupportES {
  status?: string; // '下書き' | '提出済'
  qaItems?: SupportESQA[];
}

export interface SupportCompany extends JobProgressCompany {
  id?: string;
  tasks?: SupportTask[];
  entrySheet?: SupportES | null;
  nextInterviewDate?: string; // YYYY-MM-DD
  nextInterviewTime?: string; // HH:mm
}

export interface SupportEvent {
  id: string;
  companyName: string;
  title: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm ('' if unset)
  daysLeft: number;  // 0 = today, negative = overdue
  isInterview: boolean;
}

export interface ConditionSummary {
  recordedToday: boolean;
  recordCount: number;          // records in the window
  stamina: number | null;       // 0-100, from the latest record
  mental: number | null;        // 0-100, from the latest record
  lastSleepHours: number | null;
  avgSleepHours: number | null; // window average
  avgMood: number | null;       // window average (1-5)
  shortSleepTrend: boolean;     // avg < 6h over 3+ records
  lowMoodTrend: boolean;        // avg mood <= 2.5 over 3+ records
  // 累計記録日数。連続が途切れてもリセットしない積み上げ型カウント
  totalRecordedDays: number;
}

export type AdviceTone = 'warning' | 'info' | 'good';

// MaterialIcons のグリフ名（絵文字はプラットフォームで見た目が変わるため使わない）
export type SupportAdviceIcon =
  | 'celebration'
  | 'alarm'
  | 'bedtime'
  | 'self-improvement'
  | 'mic'
  | 'assignment'
  | 'favorite'
  | 'edit'
  | 'edit-note'
  | 'local-fire-department'
  | 'spa'
  | 'business'
  | 'school';

export interface SupportAdvice {
  id: string;
  tone: AdviceTone;
  icon: SupportAdviceIcon;
  title: string;
  message: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function dateToString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Upcoming events ─────────────────────────────────────────────────────────

const INTERVIEW_RE = /面接|面談|選考|GD|グループディスカッション/;

/**
 * Collects incomplete, dated tasks across all companies within
 * [today - overdueGraceDays, today + horizonDays], sorted by date/time.
 * Older overdue tasks are dropped so long-abandoned entries don't pile up.
 * The dedicated "次回面接日時" field also produces an interview event
 * (unless an interview task on the same date already covers it).
 */
export function collectUpcomingEvents(
  companies: SupportCompany[],
  today: string,
  horizonDays = 14,
  overdueGraceDays = 7,
): SupportEvent[] {
  const events: SupportEvent[] = [];
  for (const company of companies) {
    const companyKey = company.id ?? company.name ?? 'company';
    const companyName = company.name?.trim() || '（会社名未設定）';
    const companyEvents: SupportEvent[] = [];

    for (const task of company.tasks ?? []) {
      if (task.completed) continue;
      const deadline = task.deadline ?? '';
      if (!DATE_RE.test(deadline)) continue;
      const daysLeft = diffDays(today, deadline);
      if (daysLeft > horizonDays || daysLeft < -overdueGraceDays) continue;
      const title = task.title?.trim() || '（タイトル未設定）';
      companyEvents.push({
        id: `${companyKey}_${task.id ?? title}_${deadline}`,
        companyName,
        title,
        date: deadline,
        time: task.time ?? '',
        daysLeft,
        isInterview: INTERVIEW_RE.test(title),
      });
    }

    const interviewDate = company.nextInterviewDate ?? '';
    if (DATE_RE.test(interviewDate)) {
      const daysLeft = diffDays(today, interviewDate);
      const covered = companyEvents.some(e => e.isInterview && e.date === interviewDate);
      if (daysLeft >= -overdueGraceDays && daysLeft <= horizonDays && !covered) {
        companyEvents.push({
          id: `${companyKey}_interview_${interviewDate}`,
          companyName,
          title: '面接',
          date: interviewDate,
          time: company.nextInterviewTime ?? '',
          daysLeft,
          isInterview: true,
        });
      }
    }

    events.push(...companyEvents);
  }
  return events.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || '23:59').localeCompare(b.time || '23:59'),
  );
}

// ─── Condition from health records ───────────────────────────────────────────

const APPETITE_SCORE: Record<string, number> = {
  steak: 40, set_meal: 40, noodles: 30, water: 15, nothing: 5,
};

const DAILY_ANSWER_SCORE: Record<string, number> = {
  none: 10, little: 5, some: -5, always: -10,
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sleepBonus(hours: number | undefined): number {
  if (typeof hours !== 'number' || hours <= 0) return 0;
  if (hours >= 8) return 20;
  if (hours >= 6) return 10;
  if (hours >= 5) return -10;
  return -20;
}

// Same scoring rules as HealthManagementScreen (appetite base + sleep bonus /
// mood - symptoms + daily answer), rescaled to 0-100 because the self-care
// checklist bonuses don't exist here.
export function scoreStamina(record: HealthRecord): number {
  const base = APPETITE_SCORE[record.appetite ?? ''] ?? 30;
  return clamp100(((base + sleepBonus(record.sleepHours)) / 60) * 100);
}

export function scoreMental(record: HealthRecord): number {
  const moodBase = typeof record.mood === 'number' ? record.mood * 10 : 30;
  const symptomPenalty = (record.symptoms?.length ?? 0) * 5;
  const answer = DAILY_ANSWER_SCORE[record.dailyAnswer ?? ''] ?? 0;
  return clamp100(((moodBase - symptomPenalty + answer) / 60) * 100);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * records: chronological (oldest → newest), typically the last 7-14 days.
 * totalRecordedDays: 生涯の累計記録日数（別途集計クエリで取得）。
 * 未指定ならウィンドウ内の記録数にフォールバックする。
 */
export function computeConditionSummary(
  records: HealthRecord[],
  today: string,
  totalRecordedDays?: number,
): ConditionSummary {
  const latest = records.length ? records[records.length - 1] : null;
  const recordedToday = latest?.date === today;

  const sleeps = records
    .map(r => r.sleepHours)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  const moods = records
    .map(r => r.mood)
    .filter((x): x is number => typeof x === 'number');

  const avgSleep = avg(sleeps);
  const avgMood = avg(moods);

  return {
    recordedToday,
    recordCount: records.length,
    stamina: latest ? scoreStamina(latest) : null,
    mental: latest ? scoreMental(latest) : null,
    lastSleepHours: typeof latest?.sleepHours === 'number' && latest.sleepHours > 0 ? latest.sleepHours : null,
    avgSleepHours: avgSleep,
    avgMood,
    shortSleepTrend: sleeps.length >= 3 && avgSleep !== null && avgSleep < 6,
    lowMoodTrend: moods.length >= 3 && avgMood !== null && avgMood <= 2.5,
    totalRecordedDays: totalRecordedDays ?? records.length,
  };
}

export function conditionLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: '絶好調', color: '#E67E22' };
  if (score >= 55) return { label: '好調', color: '#27AE60' };
  if (score >= 30) return { label: '正常', color: '#304E78' };
  return { label: '不調', color: '#C0392B' };
}

/** 身体スタミナとメンタルを均等に合成した総合コンディション（0-100）。 */
export function conditionScoreOf(record: HealthRecord): number {
  return Math.round((scoreStamina(record) + scoreMental(record)) / 2);
}

// ─── Job hunt phase（卒業年度ベース） ─────────────────────────────────────────

export type JobHuntPhaseKey =
  | 'early'
  | 'summer_intern'
  | 'autumn_winter'
  | 'entry_rush'
  | 'selection'
  | 'offer_period';

export interface JobHuntPhase {
  key: JobHuntPhaseKey;
  label: string;
  message: string;
}

const PHASES: Record<JobHuntPhaseKey, Omit<JobHuntPhase, 'key'>> = {
  early: {
    label: '就活準備期',
    message: '自己分析や業界研究を進める時期です。健康記録で生活リズムの土台をつくっておくと、忙しくなってからも崩れにくくなります。',
  },
  summer_intern: {
    label: 'サマーインターン期',
    message: 'サマーインターンのES締切が集中する時期です。締切の前倒しと体調管理を両立させましょう。',
  },
  autumn_winter: {
    label: '秋冬インターン・早期選考期',
    message: '秋冬インターンや早期選考が動く時期です。本選考を見据えてESのストックと面接経験を積みましょう。',
  },
  entry_rush: {
    label: 'エントリー期（広報解禁）',
    message: 'エントリーとES提出が集中する時期です。締切の前倒しと睡眠の確保を最優先に。無理な詰め込みは禁物です。',
  },
  selection: {
    label: '選考本番期（選考解禁）',
    message: '面接が本格化する時期です。面接前日の睡眠と当日のコンディションづくりを何より優先しましょう。',
  },
  offer_period: {
    label: '内定期',
    message: '内定・意思決定の時期です。残りの選考と進路の決断を、体調を整えながら自分のペースで進めましょう。',
  },
};

/** 卒業年度の短縮表記（2027 → 「27卒」）。 */
export function gradYearShortLabel(graduationYear: number): string {
  return `${graduationYear % 100}卒`;
}

/**
 * 卒業年度（YYYY年3月卒）と今日の日付から、就活の標準スケジュール上の
 * フェーズを返す。卒業後（Y年4月以降）は null。
 * 目安: 卒業2年前の6月にサマーインターン、卒業前年の3月1日に広報解禁、
 * 6月1日に選考解禁、10月1日に内定式。
 */
export function currentJobHuntPhase(graduationYear: number, today: string): JobHuntPhase | null {
  const y = graduationYear;
  const boundaries: { from: string; key: JobHuntPhaseKey }[] = [
    { from: `${y - 1}-10-01`, key: 'offer_period' },
    { from: `${y - 1}-06-01`, key: 'selection' },
    { from: `${y - 1}-03-01`, key: 'entry_rush' },
    { from: `${y - 2}-10-01`, key: 'autumn_winter' },
    { from: `${y - 2}-06-01`, key: 'summer_intern' },
  ];
  if (today >= `${y}-04-01`) return null; // 卒業後
  for (const b of boundaries) {
    if (today >= b.from) {
      return { key: b.key, ...PHASES[b.key] };
    }
  }
  return { key: 'early', ...PHASES.early };
}

// ─── Weekly planning ──────────────────────────────────────────────────────────

export type PlanKind = 'busy' | 'work' | 'rest' | 'normal';

export interface WeeklyPlanDay {
  date: string;       // YYYY-MM-DD
  weekday: number;    // 0(日)-6(土)
  // 締切はその日に「やる」ものではなく期限なので、面接（実際にその時間を
  // 拘束される予定）とは区別してマーカー表示にする
  deadlineCount: number;
  interviewCount: number;
  hasInterview: boolean;
  tendency: number | null; // この曜日の過去の平均コンディション（0-100）
  kind: PlanKind;
}

export interface WeeklyPlan {
  days: WeeklyPlanDay[];
  recommendedDate: string | null; // 面接がなくコンディション傾向が最も良い日
  weekDeadlineCount: number;      // 今後7日間の締切数
}

function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offset);
  return dateToString(dt);
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * 過去の健康記録の「曜日ごとのコンディション傾向」と今後7日間の予定から、
 * 作業に向いた日・休息すべき日を提案する。
 * 面接はその日に時間を拘束される「予定」、タスク期限はあくまで「締切」として
 * 扱い、締切日はマーカー表示のみで busy にはしない。
 */
export function buildWeeklyPlan(
  records: HealthRecord[],
  events: SupportEvent[],
  today: string,
): WeeklyPlan {
  // 曜日別の平均コンディション
  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const r of records) {
    if (!DATE_RE.test(r.date)) continue;
    byWeekday[weekdayOf(r.date)].push(conditionScoreOf(r));
  }
  const tendencies = byWeekday.map(scores =>
    scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  );

  const days: WeeklyPlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const dayEvents = events.filter(e => e.date === date);
    const interviewCount = dayEvents.filter(e => e.isInterview).length;
    const deadlineCount = dayEvents.length - interviewCount;
    const weekday = weekdayOf(date);
    const tendency = tendencies[weekday];
    let kind: PlanKind = 'normal';
    if (interviewCount > 0) kind = 'busy';
    else if (tendency !== null && tendency >= 55) kind = 'work';
    else if (tendency !== null && tendency < 40) kind = 'rest';
    days.push({
      date,
      weekday,
      deadlineCount,
      interviewCount,
      hasInterview: interviewCount > 0,
      tendency,
      kind,
    });
  }

  let recommendedDate: string | null = null;
  let best = -1;
  for (const day of days) {
    if (day.hasInterview || day.tendency === null) continue;
    if (day.tendency > best) {
      best = day.tendency;
      recommendedDate = day.date;
    }
  }
  if (best < 45) recommendedDate = null; // 傾向が良い日がなければ提案しない

  return {
    days,
    recommendedDate,
    weekDeadlineCount: days.reduce((sum, d) => sum + d.deadlineCount, 0),
  };
}

// ─── Interview retrospective ─────────────────────────────────────────────────

export interface InterviewRetroItem {
  date: string;
  companyName: string;
  title: string;
  conditionScore: number | null; // 当日の記録がなければ null
  selectionStatus: string;
}

/**
 * 過去の面接（面接系タスク＋次回面接日時フィールド）と当日の体調記録を
 * 突き合わせて、日付の新しい順に返す。
 */
export function buildInterviewRetrospective(
  companies: SupportCompany[],
  records: HealthRecord[],
  today: string,
  lookbackDays = 30,
  maxItems = 5,
): InterviewRetroItem[] {
  const recordByDate = new Map(records.map(r => [r.date, r]));
  const items: InterviewRetroItem[] = [];
  const seen = new Set<string>();

  const push = (company: SupportCompany, date: string, title: string) => {
    if (!DATE_RE.test(date)) return;
    const age = diffDays(date, today);
    if (age <= 0 || age > lookbackDays) return; // 過去 lookbackDays 日以内のみ
    const key = `${company.id ?? company.name}_${date}`;
    if (seen.has(key)) return;
    seen.add(key);
    const record = recordByDate.get(date);
    items.push({
      date,
      companyName: company.name?.trim() || '（会社名未設定）',
      title,
      conditionScore: record ? conditionScoreOf(record) : null,
      selectionStatus: company.selectionStatus ?? '',
    });
  };

  for (const company of companies) {
    for (const task of company.tasks ?? []) {
      const title = task.title?.trim() ?? '';
      if (!INTERVIEW_RE.test(title)) continue;
      push(company, task.deadline ?? '', title);
    }
    if (company.nextInterviewDate) {
      push(company, company.nextInterviewDate, '面接');
    }
  }

  return items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxItems);
}

// ─── Advice engine ────────────────────────────────────────────────────────────

function formatEventDate(e: SupportEvent): string {
  if (e.daysLeft === 0) return '今日';
  if (e.daysLeft === 1) return '明日';
  if (e.daysLeft < 0) return `${-e.daysLeft}日超過`;
  const [, m, d] = e.date.split('-').map(Number);
  return `${m}/${d}（あと${e.daysLeft}日）`;
}

const TONE_ORDER: Record<AdviceTone, number> = { warning: 0, info: 1, good: 2 };

/**
 * Rule-based advice combining the daily health records with the
 * job-hunting schedule. Returns at most `maxItems`, warnings first.
 * phase を渡すと卒業年度ベースの時期アドバイスも含める。
 */
export function buildSupportAdvice(
  condition: ConditionSummary,
  events: SupportEvent[],
  companies: SupportCompany[],
  maxItems = 5,
  phase?: JobHuntPhase | null,
): SupportAdvice[] {
  const advice: SupportAdvice[] = [];

  // 0. 就活フェーズ（卒業年度から算出）
  if (phase) {
    advice.push({
      id: `phase-${phase.key}`,
      tone: 'info',
      icon: 'school',
      title: `いまは${phase.label}です`,
      message: phase.message,
    });
  }

  const overdue = events.filter(e => e.daysLeft < 0);
  const upcoming = events.filter(e => e.daysLeft >= 0);
  const soon = upcoming.filter(e => e.daysLeft <= 3);
  const nextInterview = upcoming.find(e => e.isInterview);
  const weekLoad = upcoming.filter(e => e.daysLeft <= 7);

  const hasOffer = companies.some(c => c.selectionStatus === '内定');
  const hasRejection = companies.some(c => c.selectionStatus === '不合格');
  const draftEsCompanies = companies.filter(c => c.entrySheet?.status === '下書き');
  const lowCondition =
    (condition.stamina !== null && condition.stamina < 40) ||
    (condition.mental !== null && condition.mental < 40);

  // 1. 内定おめでとう
  if (hasOffer) {
    advice.push({
      id: 'offer',
      tone: 'good',
      icon: 'celebration',
      title: '内定おめでとうございます！',
      message: 'ここまでの積み重ねが実を結びました。残りの選考も、体調を整えながら自分のペースで進めましょう。',
    });
  }

  // 2. 期限超過タスク
  if (overdue.length > 0) {
    const first = overdue[0];
    advice.push({
      id: 'overdue',
      tone: 'warning',
      icon: 'alarm',
      title: `期限を過ぎたタスクが${overdue.length}件あります`,
      message: `「${first.companyName}：${first.title}」など。提出可能か企業マイページを確認し、不要なら完了にして整理しましょう。`,
    });
  }

  // 3. 面接直前 × 睡眠不足
  if (nextInterview && nextInterview.daysLeft <= 3) {
    const shortSleep =
      (condition.lastSleepHours !== null && condition.lastSleepHours < 6) ||
      condition.shortSleepTrend;
    if (shortSleep) {
      advice.push({
        id: 'interview-sleep',
        tone: 'warning',
        icon: 'bedtime',
        title: '面接前は睡眠を最優先に',
        message: `${formatEventDate(nextInterview)}に「${nextInterview.companyName}：${nextInterview.title}」があります。直近の睡眠が6時間を下回っています。今夜は準備を早めに切り上げて、7時間以上の睡眠を確保しましょう。`,
      });
    } else if (condition.mental !== null && condition.mental < 40) {
      advice.push({
        id: 'interview-mental',
        tone: 'warning',
        icon: 'self-improvement',
        title: '面接前にメンタルを整えましょう',
        message: `${formatEventDate(nextInterview)}に「${nextInterview.companyName}：${nextInterview.title}」があります。メンタルスコアが低めです。ホームの「心の休養休息」チェックリストで小さなリフレッシュを挟みましょう。`,
      });
    } else {
      advice.push({
        id: 'interview-ready',
        tone: 'info',
        icon: 'mic',
        title: 'まもなく面接があります',
        message: `${formatEventDate(nextInterview)}に「${nextInterview.companyName}：${nextInterview.title}」。当日は体調記録を朝のうちに済ませて、コンディションを確認してから臨みましょう。`,
      });
    }
  }

  // 4. 締切集中 × コンディション
  if (weekLoad.length >= 3) {
    advice.push({
      id: 'crunch',
      tone: lowCondition ? 'warning' : 'info',
      icon: 'assignment',
      title: `今週は締切が${weekLoad.length}件集中しています`,
      message: lowCondition
        ? '体調スコアが低めの週に締切が重なっています。優先度の低いタスクは前倒し・辞退も検討し、無理のない計画に調整しましょう。'
        : '余裕のある今日のうちに、着手できるタスクを1つ前倒ししておくと後半が楽になります。',
    });
  }

  // 5. 気分低下傾向 × 不合格経験
  if (condition.lowMoodTrend) {
    advice.push({
      id: 'low-mood',
      tone: 'warning',
      icon: 'favorite',
      title: '気分が下がり気味です',
      message: hasRejection
        ? '選考結果に気分が影響するのは自然なことです。休養も就活の一部。今日は「心の休養休息」を1つ実行して、予定は最小限にしましょう。'
        : 'ここ数日、気分の記録が低めです。就活のペースを少し落として、意識的に休息を取りましょう。',
    });
  }

  // 6. 好調 × ES下書きあり
  if (
    !lowCondition &&
    condition.mental !== null &&
    condition.mental >= 55 &&
    draftEsCompanies.length > 0 &&
    soon.length === 0
  ) {
    const names = draftEsCompanies
      .map(c => c.name?.trim() || '（会社名未設定）')
      .slice(0, 2)
      .join('・');
    advice.push({
      id: 'es-chance',
      tone: 'good',
      icon: 'edit',
      title: '調子が良い今日はES推敲のチャンス',
      message: `メンタルスコアが好調です。下書き中のES（${names}${draftEsCompanies.length > 2 ? ' ほか' : ''}）を見直すのに良いタイミングです。`,
    });
  }

  // 7. 今日の記録がまだ
  if (!condition.recordedToday) {
    advice.push({
      id: 'record-today',
      tone: 'info',
      icon: 'edit-note',
      title: '今日の体調をまだ記録していません',
      message: 'ホーム画面から今日の記録をつけると、コンディションに合わせた就活アドバイスが表示されます。',
    });
  }

  // 8. 記録の積み重ねを称える（連続でなくてもリセットされない累計日数）
  if (condition.totalRecordedDays >= 3) {
    advice.push({
      id: 'streak',
      tone: 'good',
      icon: 'local-fire-department',
      title: `体調記録が${condition.totalRecordedDays}日分たまっています`,
      message: '記録の積み重ねは自己管理力の証拠。面接で自己管理について聞かれたときのエピソードにもなります。',
    });
  }

  // 9. 予定なし → 準備期間の提案
  if (events.length === 0 && companies.length > 0) {
    advice.push({
      id: 'no-events',
      tone: 'info',
      icon: 'spa',
      title: '直近2週間の締切はありません',
      message: '比較的余裕のある時期です。企業研究・ESのストック作成・生活リズムの立て直しに充てましょう。',
    });
  }

  // 10. 企業未登録
  if (companies.length === 0) {
    advice.push({
      id: 'no-companies',
      tone: 'info',
      icon: 'business',
      title: '企業が登録されていません',
      message: '「求人管理」タブで志望企業を登録すると、締切や面接に合わせた体調アドバイスが表示されます。',
    });
  }

  return advice
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
    .slice(0, maxItems);
}
