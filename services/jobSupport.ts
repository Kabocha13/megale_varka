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
  streak: number;               // consecutive on-time recording days
}

export type AdviceTone = 'warning' | 'info' | 'good';

export interface SupportAdvice {
  id: string;
  tone: AdviceTone;
  icon: string;
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
 */
export function collectUpcomingEvents(
  companies: SupportCompany[],
  today: string,
  horizonDays = 14,
  overdueGraceDays = 7,
): SupportEvent[] {
  const events: SupportEvent[] = [];
  for (const company of companies) {
    for (const task of company.tasks ?? []) {
      if (task.completed) continue;
      const deadline = task.deadline ?? '';
      if (!DATE_RE.test(deadline)) continue;
      const daysLeft = diffDays(today, deadline);
      if (daysLeft > horizonDays || daysLeft < -overdueGraceDays) continue;
      const title = task.title?.trim() || '（タイトル未設定）';
      events.push({
        id: `${company.id ?? company.name ?? 'company'}_${task.id ?? title}_${deadline}`,
        companyName: company.name?.trim() || '（会社名未設定）',
        title,
        date: deadline,
        time: task.time ?? '',
        daysLeft,
        isInterview: INTERVIEW_RE.test(title),
      });
    }
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

function computeStreakFrom(dates: Set<string>, today: string): number {
  let cursor = today;
  if (!dates.has(cursor)) {
    const [y, m, d] = cursor.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    cursor = dateToString(dt);
  }
  let count = 0;
  while (dates.has(cursor)) {
    count += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    cursor = dateToString(dt);
  }
  return count;
}

/** records: chronological (oldest → newest), typically the last 7-14 days. */
export function computeConditionSummary(records: HealthRecord[], today: string): ConditionSummary {
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

  const onTimeDates = new Set(
    records.filter(r => r.isRetroactive !== true).map(r => r.date),
  );

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
    streak: computeStreakFrom(onTimeDates, today),
  };
}

export function conditionLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: '絶好調', color: '#E67E22' };
  if (score >= 55) return { label: '好調', color: '#27AE60' };
  if (score >= 30) return { label: '正常', color: '#304E78' };
  return { label: '不調', color: '#C0392B' };
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
 */
export function buildSupportAdvice(
  condition: ConditionSummary,
  events: SupportEvent[],
  companies: SupportCompany[],
  maxItems = 5,
): SupportAdvice[] {
  const advice: SupportAdvice[] = [];

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
      icon: '🎉',
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
      icon: '⏰',
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
        icon: '😴',
        title: '面接前は睡眠を最優先に',
        message: `${formatEventDate(nextInterview)}に「${nextInterview.companyName}：${nextInterview.title}」があります。直近の睡眠が6時間を下回っています。今夜は準備を早めに切り上げて、7時間以上の睡眠を確保しましょう。`,
      });
    } else if (condition.mental !== null && condition.mental < 40) {
      advice.push({
        id: 'interview-mental',
        tone: 'warning',
        icon: '🧘',
        title: '面接前にメンタルを整えましょう',
        message: `${formatEventDate(nextInterview)}に「${nextInterview.companyName}：${nextInterview.title}」があります。メンタルスコアが低めです。ホームの「心の休養休息」チェックリストで小さなリフレッシュを挟みましょう。`,
      });
    } else {
      advice.push({
        id: 'interview-ready',
        tone: 'info',
        icon: '🎤',
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
      icon: '📋',
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
      icon: '💙',
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
      icon: '✍️',
      title: '調子が良い今日はES推敲のチャンス',
      message: `メンタルスコアが好調です。下書き中のES（${names}${draftEsCompanies.length > 2 ? ' ほか' : ''}）を見直すのに良いタイミングです。`,
    });
  }

  // 7. 今日の記録がまだ
  if (!condition.recordedToday) {
    advice.push({
      id: 'record-today',
      tone: 'info',
      icon: '📝',
      title: '今日の体調をまだ記録していません',
      message: 'ホーム画面から今日の記録をつけると、コンディションに合わせた就活アドバイスが表示されます。',
    });
  }

  // 8. 記録の継続を称える
  if (condition.streak >= 3) {
    advice.push({
      id: 'streak',
      tone: 'good',
      icon: '🔥',
      title: `体調記録が${condition.streak}日連続です`,
      message: '記録の継続は自己管理力の証拠。面接で自己管理について聞かれたときのエピソードにもなります。',
    });
  }

  // 9. 予定なし → 準備期間の提案
  if (events.length === 0 && companies.length > 0) {
    advice.push({
      id: 'no-events',
      tone: 'info',
      icon: '🌱',
      title: '直近2週間の締切はありません',
      message: '比較的余裕のある時期です。企業研究・ESのストック作成・生活リズムの立て直しに充てましょう。',
    });
  }

  // 10. 企業未登録
  if (companies.length === 0) {
    advice.push({
      id: 'no-companies',
      tone: 'info',
      icon: '🏢',
      title: '企業が登録されていません',
      message: '「求人管理」タブで志望企業を登録すると、締切や面接に合わせた体調アドバイスが表示されます。',
    });
  }

  return advice
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
    .slice(0, maxItems);
}
