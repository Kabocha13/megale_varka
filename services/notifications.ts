import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';

export const REMINDER_DAYS_KEY = '@reminder_days_v2';
export const DEFAULT_REMINDER_DAYS: number[] = [1];
export const ALL_REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7, 14];

const CHANNEL_ID = 'job_tasks';

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
  const rawTime = /^\d{1,2}:\d{2}$/.test(time ?? '') ? time : '23:59';
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
