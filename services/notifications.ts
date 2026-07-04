import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';

export const REMINDER_DAYS_KEY = '@reminder_days_v2';
export const DEFAULT_REMINDER_DAYS: number[] = [1];
export const ALL_REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7, 14];

const CHANNEL_ID = 'job_tasks';

export const DAILY_REMINDER_KEY = '@daily_health_reminder_v1';
const DAILY_REMINDER_CHANNEL_ID = 'health_reminder';
const DAILY_REMINDER_NOTIF_ID = 'daily_health_reminder';

export interface DailyReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_DAILY_REMINDER: DailyReminderConfig = {
  enabled: false,
  hour: 20,
  minute: 0,
};

// ─── 設定 ─────────────────────────────────────────────────────────────────────

function sanitizeReminderDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_DAYS];
  const allowedDays = new Set<number>(ALL_REMINDER_DAY_OPTIONS);
  const sanitizedDays = Array.from(
    new Set(
      value.filter(
        (day): day is number =>
          typeof day === 'number' &&
          Number.isFinite(day) &&
          allowedDays.has(day),
      ),
    ),
  ).sort((a, b) => a - b);

  return sanitizedDays.length > 0
    ? sanitizedDays
    : [...DEFAULT_REMINDER_DAYS];
}

export async function getReminderDays(): Promise<number[]> {
  const val = await AsyncStorage.getItem(REMINDER_DAYS_KEY);
  if (val === null) return [...DEFAULT_REMINDER_DAYS];
  try {
    const parsed: unknown = JSON.parse(val);
    return sanitizeReminderDays(parsed);
  } catch {
    return [...DEFAULT_REMINDER_DAYS];
  }
}

export async function saveReminderDays(days: number[]): Promise<void> {
  await AsyncStorage.setItem(
    REMINDER_DAYS_KEY,
    JSON.stringify(sanitizeReminderDays(days)),
  );
}

// ─── 権限 ─────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

// ─── チャンネル（Android） ────────────────────────────────────────────────────

async function ensureChannel(): Promise<string> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'タスクリマインダー',
    importance: AndroidImportance.HIGH,
  });
  return CHANNEL_ID;
}

// ─── 通知スケジュール ─────────────────────────────────────────────────────────

export async function scheduleTaskNotification(
  taskId: string,
  taskTitle: string,
  companyName: string,
  deadline: string,
  time: string,
  reminderDaysList: number[],
): Promise<void> {
  const parts = deadline.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return;
  const [year, month, day] = parts;
  const rawTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time ?? '') ? time! : '23:59';
  const [h, m] = rawTime.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return;

  await cancelTaskNotification(taskId);

  const channelId = await ensureChannel();

  for (const reminderDays of reminderDaysList) {
    const notifyDate = new Date(year, month - 1, day, h, m, 0);
    notifyDate.setDate(notifyDate.getDate() - reminderDays);

    if (notifyDate.getTime() <= Date.now()) continue;

    const label = reminderDays === 0 ? '本日期限' : `${reminderDays}日前`;
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: notifyDate.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `${taskId}_${reminderDays}d`,
        title: `【${label}】${companyName}`,
        body: taskTitle || 'タスクの期限が近づいています',
        android: { channelId, importance: AndroidImportance.HIGH },
        ios: { sound: 'default' },
      },
      trigger,
    );
  }
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  await Promise.all(
    ALL_REMINDER_DAY_OPTIONS.map(d =>
      notifee.cancelTriggerNotification(`${taskId}_${d}d`).catch(() => {}),
    ),
  );
}

// ─── 面接前夜リマインダー ─────────────────────────────────────────────────────

const INTERVIEW_EVE_CHANNEL_ID = 'interview_eve';
const INTERVIEW_EVE_HOUR = 21;

async function ensureInterviewEveChannel(): Promise<string> {
  await notifee.createChannel({
    id: INTERVIEW_EVE_CHANNEL_ID,
    name: '面接前夜リマインダー',
    importance: AndroidImportance.HIGH,
  });
  return INTERVIEW_EVE_CHANNEL_ID;
}

/**
 * 面接前日の21:00に「早めの就寝」を促す通知をスケジュールする。
 * 前日21:00がすでに過ぎている場合は何もしない。
 */
export async function scheduleInterviewEveNotification(
  companyId: string,
  companyName: string,
  interviewDate: string, // YYYY-MM-DD
  interviewTime: string, // HH:mm（不明な場合は ''）
): Promise<void> {
  await cancelInterviewEveNotification(companyId);

  const parts = interviewDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return;
  const [year, month, day] = parts;

  const eve = new Date(year, month - 1, day - 1, INTERVIEW_EVE_HOUR, 0, 0);
  if (eve.getTime() <= Date.now()) return;

  const channelId = await ensureInterviewEveChannel();
  const timeLabel = /^([01]?\d|2[0-3]):[0-5]\d$/.test(interviewTime)
    ? `${interviewTime}から`
    : '';

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: eve.getTime(),
  };

  await notifee.createTriggerNotification(
    {
      id: `interview_eve_${companyId}`,
      title: `明日は${companyName || '企業'}の面接です`,
      body: `明日${timeLabel}面接があります。今夜は早めに就寝して、ベストコンディションで臨みましょう。`,
      android: { channelId, importance: AndroidImportance.HIGH },
      ios: { sound: 'default' },
    },
    trigger,
  );
}

export async function cancelInterviewEveNotification(companyId: string): Promise<void> {
  await notifee.cancelTriggerNotification(`interview_eve_${companyId}`).catch(() => {});
}

// ─── 毎日ヘルス記録リマインダー ───────────────────────────────────────────────

export async function getDailyReminderConfig(): Promise<DailyReminderConfig> {
  const val = await AsyncStorage.getItem(DAILY_REMINDER_KEY);
  if (val === null) return { ...DEFAULT_DAILY_REMINDER };
  try {
    const parsed: unknown = JSON.parse(val);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'enabled' in parsed &&
      'hour' in parsed &&
      'minute' in parsed &&
      typeof (parsed as DailyReminderConfig).enabled === 'boolean' &&
      typeof (parsed as DailyReminderConfig).hour === 'number' &&
      typeof (parsed as DailyReminderConfig).minute === 'number'
    ) {
      return parsed as DailyReminderConfig;
    }
    return { ...DEFAULT_DAILY_REMINDER };
  } catch {
    return { ...DEFAULT_DAILY_REMINDER };
  }
}

export async function saveDailyReminderConfig(config: DailyReminderConfig): Promise<void> {
  await AsyncStorage.setItem(DAILY_REMINDER_KEY, JSON.stringify(config));
}

async function ensureHealthReminderChannel(): Promise<string> {
  await notifee.createChannel({
    id: DAILY_REMINDER_CHANNEL_ID,
    name: 'ヘルス記録リマインダー',
    importance: AndroidImportance.HIGH,
  });
  return DAILY_REMINDER_CHANNEL_ID;
}

export async function scheduleDailyHealthReminder(hour: number, minute: number): Promise<void> {
  await cancelDailyHealthReminder();

  const channelId = await ensureHealthReminderChannel();

  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);
  if (trigger.getTime() <= now.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }

  const timestampTrigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: trigger.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
  };

  await notifee.createTriggerNotification(
    {
      id: DAILY_REMINDER_NOTIF_ID,
      title: '健康記録のリマインダー',
      body: '今日の健康データを記録しましょう！',
      android: { channelId, importance: AndroidImportance.HIGH },
      ios: { sound: 'default' },
    },
    timestampTrigger,
  );
}

export async function cancelDailyHealthReminder(): Promise<void> {
  await notifee.cancelTriggerNotification(DAILY_REMINDER_NOTIF_ID).catch(() => {});
}
