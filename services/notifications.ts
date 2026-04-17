import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';

export const REMINDER_DAYS_KEY = '@reminder_days_v1';
export const DEFAULT_REMINDER_DAYS = 1;

const CHANNEL_ID = 'job_tasks';

// ─── 設定 ─────────────────────────────────────────────────────────────────────

export async function getReminderDays(): Promise<number> {
  const val = await AsyncStorage.getItem(REMINDER_DAYS_KEY);
  return val !== null ? parseInt(val, 10) : DEFAULT_REMINDER_DAYS;
}

export async function saveReminderDays(days: number): Promise<void> {
  await AsyncStorage.setItem(REMINDER_DAYS_KEY, String(days));
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
  reminderDays: number,
): Promise<void> {
  const parts = deadline.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return;
  const [year, month, day] = parts;

  const [h, m] = (time || '23:59').split(':').map(Number);
  const notifyDate = new Date(year, month - 1, day, h, m, 0);
  notifyDate.setDate(notifyDate.getDate() - reminderDays);

  if (notifyDate.getTime() <= Date.now()) {
    await cancelTaskNotification(taskId);
    return;
  }

  const channelId = await ensureChannel();
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: notifyDate.getTime(),
  };

  const label = reminderDays === 0 ? '本日期限' : `${reminderDays}日前`;

  await notifee.createTriggerNotification(
    {
      id: taskId,
      title: `【${label}】${companyName}`,
      body: taskTitle || 'タスクの期限が近づいています',
      android: { channelId, importance: AndroidImportance.HIGH },
      ios: { sound: 'default' },
    },
    trigger,
  );
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  await notifee.cancelTriggerNotification(taskId);
}
