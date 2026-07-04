import notifee, { AuthorizationStatus } from '@notifee/react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { hasRequestedHealthKit, isHealthKitAvailable } from '../services/healthService';
import { getGraduationYear, graduationYearOptions, saveGraduationYear } from '../services/profile';
import { gradYearShortLabel } from '../services/jobSupport';
import {
  DEFAULT_DAILY_REMINDER,
  DEFAULT_REMINDER_DAYS,
  DailyReminderConfig,
  cancelDailyHealthReminder,
  getDailyReminderConfig,
  getReminderDays,
  saveDailyReminderConfig,
  saveReminderDays,
  scheduleDailyHealthReminder,
} from '../services/notifications';

type PermStatus = 'granted' | 'denied' | 'unavailable' | 'loading';

interface PermState {
  notification: PermStatus;
  healthKit: PermStatus;
}

async function fetchPermStatuses(): Promise<PermState> {
  const [notifSettings, hkAsked] = await Promise.all([
    notifee.getNotificationSettings(),
    hasRequestedHealthKit(),
  ]);

  const notifGranted =
    notifSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    notifSettings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

  const hkAvail = isHealthKitAvailable();

  return {
    notification: notifGranted ? 'granted' : 'denied',
    healthKit: !hkAvail ? 'unavailable' : hkAsked ? 'granted' : 'denied',
  };
}

const REMINDER_OPTIONS = [
  { label: '当日', days: 0 },
  { label: '1日前', days: 1 },
  { label: '2日前', days: 2 },
  { label: '3日前', days: 3 },
  { label: '1週間前', days: 7 },
  { label: '2週間前', days: 14 },
];

function daysLabel(selected: number[]): string {
  if (selected.length === 0) return '未設定';
  return selected
    .slice()
    .sort((a, b) => a - b)
    .map(d => REMINDER_OPTIONS.find(o => o.days === d)?.label ?? `${d}日前`)
    .join('・');
}

export default function SettingsScreen() {
  const { email, logout } = useAuth();
  const [reminderDays, setReminderDays] = useState<number[]>(DEFAULT_REMINDER_DAYS);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<number[]>(DEFAULT_REMINDER_DAYS);
  const [perms, setPerms] = useState<PermState>({ notification: 'loading', healthKit: 'loading' });
  const [dailyReminder, setDailyReminder] = useState<DailyReminderConfig>(DEFAULT_DAILY_REMINDER);
  const [graduationYear, setGraduationYear] = useState<number | null>(null);
  const [showGradPicker, setShowGradPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(DEFAULT_DAILY_REMINDER.hour, DEFAULT_DAILY_REMINDER.minute, 0, 0);
    return d;
  });
  const appState = useRef(AppState.currentState);

  const refreshPerms = useCallback(() => {
    fetchPermStatuses().then(setPerms).catch(() => {});
  }, []);

  useEffect(() => {
    getReminderDays().then(days => {
      setReminderDays(days);
      setDraft(days);
    }).catch(() => {});

    getDailyReminderConfig().then(config => {
      setDailyReminder(config);
      const d = new Date();
      d.setHours(config.hour, config.minute, 0, 0);
      setPickerDate(d);
    }).catch(() => {});

    getGraduationYear().then(setGraduationYear).catch(() => {});

    refreshPerms();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refreshPerms();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refreshPerms]);

  const handleOpenPicker = () => {
    setDraft(reminderDays);
    setShowPicker(true);
  };

  const handleToggle = (days: number) => {
    setDraft(prev =>
      prev.includes(days) ? prev.filter(d => d !== days) : [...prev, days],
    );
  };

  const handleConfirm = async () => {
    setReminderDays(draft);
    setShowPicker(false);
    await saveReminderDays(draft).catch(() => {});
  };

  const handleToggleDaily = async (enabled: boolean) => {
    const newConfig = { ...dailyReminder, enabled };
    setDailyReminder(newConfig);
    await saveDailyReminderConfig(newConfig).catch(() => {});
    if (enabled) {
      await scheduleDailyHealthReminder(newConfig.hour, newConfig.minute).catch(() => {});
    } else {
      await cancelDailyHealthReminder().catch(() => {});
    }
  };

  const openTimePicker = () => {
    const d = new Date();
    d.setHours(dailyReminder.hour, dailyReminder.minute, 0, 0);
    setPickerDate(d);
    setShowTimePicker(true);
  };

  const applyTime = async (hour: number, minute: number) => {
    const newConfig = { ...dailyReminder, hour, minute };
    setDailyReminder(newConfig);
    await saveDailyReminderConfig(newConfig).catch(() => {});
    if (newConfig.enabled) {
      await scheduleDailyHealthReminder(hour, minute).catch(() => {});
    }
  };

  const handlePickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (!date) {
      if (Platform.OS === 'android') setShowTimePicker(false);
      return;
    }
    setPickerDate(date);
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      applyTime(date.getHours(), date.getMinutes()).catch(() => {});
    }
  };

  const handleIOSConfirm = () => {
    setShowTimePicker(false);
    applyTime(pickerDate.getHours(), pickerDate.getMinutes()).catch(() => {});
  };

  const timeLabel = `${String(dailyReminder.hour).padStart(2, '0')}:${String(dailyReminder.minute).padStart(2, '0')}`;

  const handleSelectGradYear = async (year: number | null) => {
    setGraduationYear(year);
    setShowGradPicker(false);
    await saveGraduationYear(year).catch(() => {});
  };

  const handleLogoutPress = async () => {
    try {
      await logout();
    } catch {
      Alert.alert('エラー', 'ログアウトに失敗しました。もう一度お試しください。');
    }
  };

  const handleOpenIbasho = () => {
    Linking.openURL('https://talkme.jp/').catch(() => {
      Alert.alert('エラー', 'ページを開けませんでした。時間をおいてもう一度お試しください。');
    });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>設定</Text>

      {/* アクセス許可 */}
      <Text style={s.sectionTitle}>アクセス許可</Text>
      <View style={s.card}>
        <PermRow
          label="通知"
          status={perms.notification}
          unavailableText=""
        />
        <View style={s.divider} />
        <PermRow
          label="ヘルスケア"
          status={perms.healthKit}
          unavailableText="iOSのみ利用可能"
        />
        {(perms.notification === 'denied' || perms.healthKit === 'denied') && (
          <TouchableOpacity style={s.openSettingsBtn} onPress={() => Linking.openSettings()}>
            <Text style={s.openSettingsBtnText}>設定を開く</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* リマインド設定 */}
      <Text style={s.sectionTitle}>通知・リマインド</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>毎日リマインダー</Text>
            <Text style={s.rowSub}>ヘルス記録を毎日お知らせ</Text>
          </View>
          <Switch
            value={dailyReminder.enabled}
            onValueChange={handleToggleDaily}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
          />
        </View>
        {dailyReminder.enabled && (
          <>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Text style={s.rowLabel}>通知時刻</Text>
              </View>
              <TouchableOpacity style={s.valueBtn} onPress={openTimePicker}>
                <Text style={s.valueBtnText}>{timeLabel}</Text>
                <Text style={s.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={s.divider} />
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>タスクリマインド</Text>
            <Text style={s.rowSub}>期限の何日前に通知するか（複数選択可）</Text>
          </View>
          <TouchableOpacity style={s.valueBtn} onPress={handleOpenPicker}>
            <Text style={s.valueBtnText} numberOfLines={1}>{daysLabel(reminderDays)}</Text>
            <Text style={s.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 就活プロフィール */}
      <Text style={s.sectionTitle}>就活プロフィール</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>卒業年度</Text>
            <Text style={s.rowSub}>就活スケジュールに合わせたアドバイスに使われます</Text>
          </View>
          <TouchableOpacity style={s.valueBtn} onPress={() => setShowGradPicker(true)}>
            <Text style={s.valueBtnText} numberOfLines={1}>
              {graduationYear !== null
                ? `${graduationYear}年3月卒（${gradYearShortLabel(graduationYear)}）`
                : '未設定'}
            </Text>
            <Text style={s.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 相談窓口 */}
      <Text style={s.sectionTitle}>相談窓口</Text>
      <View style={s.card}>
        <View style={s.infoBlock}>
          <Text style={s.infoTitle}>特定非営利活動法人 あなたのいばしょ</Text>
          <Text style={s.infoText}>
            24時間365日、年齢や性別を問わず、誰でも無料・匿名で利用できるチャット相談窓口です。
            ここはいつでも、だれでもチャットで相談できます。あなたのひみつは守ります。
            まずはお話してみませんか。
          </Text>
          <View style={s.infoMetaRow}>
            <Text style={s.infoMetaLabel}>実施日時</Text>
            <Text style={s.infoMetaText}>24時間365日</Text>
          </View>
          <View style={s.infoMetaRow}>
            <Text style={s.infoMetaLabel}>チャット</Text>
            <Text style={s.infoMetaText}>あなたのいばしょチャット相談</Text>
          </View>
          <TouchableOpacity style={s.linkButton} onPress={handleOpenIbasho}>
            <Text style={s.linkButtonText}>団体ホームページを開く</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ログアウト */}
      <Text style={s.sectionTitle}>アカウント</Text>
      <View style={s.card}>
        <View style={s.accountRow}>
          <Text style={s.accountLabel}>メールアドレス</Text>
          <Text style={s.accountEmail} numberOfLines={1}>{email}</Text>
        </View>
        <View style={s.divider} />
        <TouchableOpacity style={s.logoutRow} onPress={handleLogoutPress}>
          <Text style={s.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* 毎日リマインダー 時刻ピッカー（Android） */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          mode="time"
          value={pickerDate}
          is24Hour
          onChange={handlePickerChange}
        />
      )}

      {/* 毎日リマインダー 時刻ピッカー（iOS） */}
      <Modal visible={showTimePicker && Platform.OS === 'ios'} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={s.overlay}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>通知時刻</Text>
            <DateTimePicker
              mode="time"
              value={pickerDate}
              is24Hour
              display="spinner"
              onChange={handlePickerChange}
              style={s.iosTimePicker}
            />
            <View style={s.pickerActions}>
              <TouchableOpacity style={s.pickerCancelBtn} onPress={() => setShowTimePicker(false)}>
                <Text style={s.pickerCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pickerConfirmBtn} onPress={handleIOSConfirm}>
                <Text style={s.pickerConfirmText}>完了</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 卒業年度ピッカー */}
      <Modal visible={showGradPicker} transparent animationType="fade" onRequestClose={() => setShowGradPicker(false)}>
        <View style={s.overlay}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>卒業年度</Text>
            <Text style={s.pickerSub}>3月に卒業する年を選んでください</Text>
            {[null, ...graduationYearOptions()].map(year => {
              const selected = graduationYear === year;
              return (
                <TouchableOpacity
                  key={year ?? 'none'}
                  style={[s.pickerOption, selected && s.pickerOptionSelected]}
                  onPress={() => handleSelectGradYear(year)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[s.pickerOptionText, selected && s.pickerOptionTextSelected]}>
                    {year !== null ? `${year}年3月卒（${gradYearShortLabel(year)}）` : '未設定'}
                  </Text>
                  {selected && <Text style={s.pickerOptionTextSelected}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={s.pickerActions}>
              <TouchableOpacity style={s.pickerCancelBtn} onPress={() => setShowGradPicker(false)}>
                <Text style={s.pickerCancelText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* リマインド日数ピッカー（複数選択） */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={s.overlay}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>リマインドのタイミング</Text>
            <Text style={s.pickerSub}>複数選択できます</Text>
            {REMINDER_OPTIONS.map(opt => {
              const selected = draft.includes(opt.days);
              return (
                <TouchableOpacity
                  key={opt.days}
                  style={[s.pickerOption, selected && s.pickerOptionSelected]}
                  onPress={() => handleToggle(opt.days)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[s.pickerOptionText, selected && s.pickerOptionTextSelected]}>
                    {opt.label}
                  </Text>
                  <View style={[s.checkbox, selected && s.checkboxSelected]}>
                    {selected && <Text style={s.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={s.pickerActions}>
              <TouchableOpacity style={s.pickerCancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={s.pickerCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pickerConfirmBtn} onPress={handleConfirm}>
                <Text style={s.pickerConfirmText}>完了</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function PermRow({ label, status, unavailableText }: {
  label: string;
  status: PermStatus;
  unavailableText: string;
}) {
  let badge: string;
  let badgeStyle: object;
  let badgeTextStyle: object;

  if (status === 'loading') {
    badge = '確認中…';
    badgeStyle = s.badgeNeutral;
    badgeTextStyle = s.badgeNeutralText;
  } else if (status === 'granted') {
    badge = '✓ 許可済み';
    badgeStyle = s.badgeGranted;
    badgeTextStyle = s.badgeGrantedText;
  } else if (status === 'denied') {
    badge = '✕ 未許可';
    badgeStyle = s.badgeDenied;
    badgeTextStyle = s.badgeDeniedText;
  } else {
    badge = unavailableText || '利用不可';
    badgeStyle = s.badgeNeutral;
    badgeTextStyle = s.badgeNeutralText;
  }

  return (
    <View style={s.permRow}>
      <Text style={s.permLabel}>{label}</Text>
      <View style={[s.badge, badgeStyle]}>
        <Text style={[s.badgeText, badgeTextStyle]}>{badge}</Text>
      </View>
    </View>
  );
}

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  card: '#FFFFFF',
  border: '#D9D0C8',
  text: '#333333',
  sub: '#555555',
  muted: '#A8BDD4',
  danger: '#E53935',
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: C.primary, marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: C.sub, marginBottom: 8, marginTop: 16 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { flex: 1, marginRight: 8 },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  valueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '55%',
  },
  valueBtnText: { fontSize: 13, color: C.primary, fontWeight: 'bold', marginRight: 4, flexShrink: 1 },
  arrow: { fontSize: 10, color: C.muted },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  permLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 16 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  badgeGranted: { backgroundColor: '#E8F5E9' },
  badgeGrantedText: { color: '#2E7D32' },
  badgeDenied: { backgroundColor: '#FFEBEE' },
  badgeDeniedText: { color: '#C62828' },
  badgeNeutral: { backgroundColor: '#F5F5F5' },
  badgeNeutralText: { color: C.muted },
  openSettingsBtn: {
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  openSettingsBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  infoBlock: { paddingVertical: 16, paddingHorizontal: 16 },
  infoTitle: { fontSize: 16, color: C.text, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 13, color: C.sub, lineHeight: 21, marginBottom: 14 },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  infoMetaLabel: { width: 72, fontSize: 12, color: C.muted, fontWeight: 'bold' },
  infoMetaText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  linkButton: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F0F4FA',
    alignItems: 'center',
  },
  linkButtonText: { color: C.primary, fontSize: 14, fontWeight: 'bold' },
  accountRow: { paddingVertical: 14, paddingHorizontal: 16 },
  accountLabel: { fontSize: 12, color: C.muted, marginBottom: 4 },
  accountEmail: { fontSize: 15, color: C.text, fontWeight: '500' },
  logoutRow: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  logoutText: { color: C.danger, fontSize: 16, fontWeight: 'bold' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSheet: {
    backgroundColor: C.card,
    borderRadius: 14,
    width: '82%',
    padding: 16,
  },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: C.text, textAlign: 'center', marginBottom: 4 },
  pickerSub: { fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 12 },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: { backgroundColor: '#EBF0F8' },
  pickerOptionText: { fontSize: 15, color: C.text },
  pickerOptionTextSelected: { color: C.primary, fontWeight: 'bold' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { borderColor: C.primary, backgroundColor: C.primary },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  pickerActions: {
    flexDirection: 'row',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    gap: 8,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  pickerCancelText: { color: C.sub, fontSize: 15 },
  pickerConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: C.primary,
  },
  pickerConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  iosTimePicker: { width: '100%', height: 180 },
});
