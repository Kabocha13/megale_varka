import notifee, { AuthorizationStatus } from '@notifee/react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import TermsScreen from './TermsScreen';
import {
  Announcement,
  countUnread,
  fetchAnnouncements,
  formatAnnouncementDate,
  getLastReadMillis,
  saveLastReadMillis,
} from '../services/announcements';
import {
  authenticateWithBiometrics,
  biometryLabel,
  disableAppLock,
  enableAppLock,
  getBiometryType,
  isAppLockEnabled,
} from '../services/appLock';
import { hasRequestedHealthKit, isHealthKitAvailable } from '../services/healthService';
import {
  INQUIRY_CATEGORIES,
  SUPPORT_EMAIL,
  buildInquiryMailUrl,
  submitInquiry,
} from '../services/inquiry';
import { getGraduationYear, graduationYearOptions, saveGraduationYear } from '../services/profile';
import { gradYearShortLabel } from '../services/jobSupport';
import { DEVELOPER_NAME } from '../services/terms';
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

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'demo-1',
    title: 'デモモードのお知らせ',
    body: 'これはデモ表示です。実際のお知らせは運営がFirebaseに登録したものが表示されます。',
    createdAtMillis: Date.now(),
  },
];

export default function SettingsScreen() {
  const { uid, email, isDemo, logout } = useAuth();
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

  // 生体認証ロック
  const [biometryName, setBiometryName] = useState<string>('生体認証');
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  // 運営からのお知らせ
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lastReadMillis, setLastReadMillis] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);

  // お問い合わせフォーム
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryCategory, setInquiryCategory] = useState<string>(INQUIRY_CATEGORIES[0]);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySending, setInquirySending] = useState(false);

  // 利用規約
  const [showTerms, setShowTerms] = useState(false);

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

    getBiometryType().then(type => {
      setBiometryAvailable(type !== null);
      setBiometryName(biometryLabel(type));
    }).catch(() => {});
    isAppLockEnabled().then(setAppLockEnabled).catch(() => {});

    getLastReadMillis().then(setLastReadMillis).catch(() => {});
    if (isDemo) {
      setAnnouncements(DEMO_ANNOUNCEMENTS);
    } else {
      fetchAnnouncements().then(setAnnouncements).catch(() => {});
    }

    refreshPerms();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refreshPerms();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refreshPerms, isDemo]);

  const unreadCount = countUnread(announcements, lastReadMillis);

  const handleOpenAnnouncements = () => {
    setShowAnnouncements(true);
    // 開いた時点で既読にする
    const newest = announcements.reduce((max, a) => Math.max(max, a.createdAtMillis), 0);
    if (newest > lastReadMillis) {
      saveLastReadMillis(newest).catch(() => {});
    }
  };

  const handleCloseAnnouncements = () => {
    setShowAnnouncements(false);
    const newest = announcements.reduce((max, a) => Math.max(max, a.createdAtMillis), 0);
    if (newest > lastReadMillis) setLastReadMillis(newest);
  };

  const handleToggleAppLock = async (enabled: boolean) => {
    if (enabled) {
      setAppLockEnabled(true);
      try {
        await enableAppLock();
        const verified = await authenticateWithBiometrics();
        if (!verified) {
          throw new Error('verification failed');
        }
      } catch {
        await disableAppLock().catch(() => {});
        setAppLockEnabled(false);
        Alert.alert(
          'ロックを設定できませんでした',
          `${biometryName}を確認できませんでした。端末に生体認証（またはパスコード）が設定されているか確認してください。`,
        );
      }
    } else {
      setAppLockEnabled(false);
      await disableAppLock().catch(() => {});
    }
  };

  const handleSubmitInquiry = async () => {
    const message = inquiryMessage.trim();
    if (!message) {
      Alert.alert('エラー', 'お問い合わせ内容を入力してください。');
      return;
    }
    setInquirySending(true);
    try {
      if (!isDemo) {
        await submitInquiry({ uid, email, category: inquiryCategory, message });
      }
      setInquirySending(false);
      setShowInquiry(false);
      setInquiryMessage('');
      Alert.alert('送信しました', 'お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご連絡します。');
    } catch {
      setInquirySending(false);
      Alert.alert(
        '送信できませんでした',
        '通信状態を確認して再度お試しください。解決しない場合はメールでお問い合わせください。',
      );
    }
  };

  const handleOpenInquiryMail = () => {
    Linking.openURL(buildInquiryMailUrl(inquiryCategory, email)).catch(() => {
      Alert.alert('エラー', `メールアプリを開けませんでした。${SUPPORT_EMAIL} 宛にお問い合わせください。`);
    });
  };

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

      {/* 運営からのお知らせ */}
      <Text style={s.sectionTitle}>運営からのお知らせ</Text>
      <View style={[s.card, unreadCount > 0 && s.cardHighlight]}>
        <TouchableOpacity
          style={s.row}
          onPress={handleOpenAnnouncements}
          accessibilityRole="button"
          accessibilityLabel={`お知らせを開く${unreadCount > 0 ? `（新着${unreadCount}件）` : ''}`}
        >
          <View style={s.rowLeft}>
            <View style={s.announceLabelRow}>
              <Text style={s.rowLabel}>お知らせ</Text>
              {unreadCount > 0 && (
                <View style={s.newBadge}>
                  <Text style={s.newBadgeText}>NEW {unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={s.rowSub} numberOfLines={1}>
              {announcements.length > 0
                ? announcements[0].title
                : '現在お知らせはありません'}
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </View>

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

      {/* セキュリティ */}
      <Text style={s.sectionTitle}>セキュリティ</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>生体認証ロック</Text>
            <Text style={s.rowSub}>
              {biometryAvailable
                ? `起動時に${biometryName}でロックを解除します`
                : 'この端末では生体認証を利用できません'}
            </Text>
          </View>
          <Switch
            value={appLockEnabled}
            onValueChange={handleToggleAppLock}
            disabled={!biometryAvailable && !appLockEnabled}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
          />
        </View>
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

      {/* お問い合わせ */}
      <Text style={s.sectionTitle}>お問い合わせ</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.row}
          onPress={() => setShowInquiry(true)}
          accessibilityRole="button"
          accessibilityLabel="お問い合わせフォームを開く"
        >
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>お問い合わせフォーム</Text>
            <Text style={s.rowSub}>不具合の報告・機能の要望などはこちら</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity
          style={s.row}
          onPress={handleOpenInquiryMail}
          accessibilityRole="button"
          accessibilityLabel="メールで問い合わせる"
        >
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>メールで問い合わせる</Text>
            <Text style={s.rowSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* アプリ情報 */}
      <Text style={s.sectionTitle}>アプリ情報</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.row}
          onPress={() => setShowTerms(true)}
          accessibilityRole="button"
          accessibilityLabel="利用規約を表示"
        >
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>利用規約</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>開発者</Text>
          </View>
          <Text style={s.rowValueText}>{DEVELOPER_NAME}</Text>
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

      {/* 運営からのお知らせ */}
      <Modal visible={showAnnouncements} animationType="slide" onRequestClose={handleCloseAnnouncements}>
        <View style={s.fullModalRoot}>
          <View style={s.fullModalHeader}>
            <Text style={s.fullModalTitle}>運営からのお知らせ</Text>
            <TouchableOpacity
              onPress={handleCloseAnnouncements}
              accessibilityRole="button"
              accessibilityLabel="お知らせを閉じる"
            >
              <Text style={s.fullModalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.fullModalScroll} contentContainerStyle={s.fullModalContent}>
            {announcements.length === 0 ? (
              <Text style={s.announceEmpty}>現在お知らせはありません</Text>
            ) : (
              announcements.map(a => {
                const isNew = a.createdAtMillis > lastReadMillis;
                return (
                  <View key={a.id} style={[s.announceCard, isNew && s.announceCardNew]}>
                    <View style={s.announceHeader}>
                      {isNew && (
                        <View style={s.newBadge}>
                          <Text style={s.newBadgeText}>NEW</Text>
                        </View>
                      )}
                      <Text style={s.announceDate}>{formatAnnouncementDate(a.createdAtMillis)}</Text>
                    </View>
                    <Text style={s.announceTitle}>{a.title}</Text>
                    <Text style={s.announceBody}>{a.body}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* お問い合わせフォーム */}
      <Modal visible={showInquiry} animationType="slide" onRequestClose={() => setShowInquiry(false)}>
        <View style={s.fullModalRoot}>
          <View style={s.fullModalHeader}>
            <Text style={s.fullModalTitle}>お問い合わせ</Text>
            <TouchableOpacity
              onPress={() => setShowInquiry(false)}
              accessibilityRole="button"
              accessibilityLabel="お問い合わせフォームを閉じる"
            >
              <Text style={s.fullModalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.fullModalScroll}
            contentContainerStyle={s.fullModalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.inquiryLabel}>お問い合わせの種類</Text>
            <View style={s.inquiryChipRow}>
              {INQUIRY_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.inquiryChip, inquiryCategory === cat && s.inquiryChipActive]}
                  onPress={() => setInquiryCategory(cat)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: inquiryCategory === cat }}
                >
                  <Text style={[s.inquiryChipText, inquiryCategory === cat && s.inquiryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inquiryLabel}>内容</Text>
            <TextInput
              style={s.inquiryInput}
              value={inquiryMessage}
              onChangeText={setInquiryMessage}
              placeholder={'できるだけ詳しくご記入ください。\n不具合の場合は、操作手順や表示されたエラーも書いていただけると助かります。'}
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.inquiryNote}>
              ログイン中のメールアドレス（{email ?? '未ログイン'}）が問い合わせに添付されます。
            </Text>

            <TouchableOpacity
              style={[s.inquirySubmitBtn, inquirySending && s.inquirySubmitBtnDisabled]}
              onPress={handleSubmitInquiry}
              disabled={inquirySending}
              accessibilityRole="button"
            >
              {inquirySending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.inquirySubmitBtnText}>送信する</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.inquiryMailLink} onPress={handleOpenInquiryMail}>
              <Text style={s.inquiryMailLinkText}>メールアプリで問い合わせる（{SUPPORT_EMAIL}）</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* 利用規約 */}
      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <TermsScreen mode="view" onClose={() => setShowTerms(false)} />
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
  warning: '#F59E0B',
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
  cardHighlight: { borderColor: C.warning, borderWidth: 2 },
  chevron: { fontSize: 22, color: C.muted, marginLeft: 8 },
  rowValueText: { fontSize: 14, color: C.text },
  announceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newBadge: {
    backgroundColor: C.warning,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  fullModalRoot: { flex: 1, backgroundColor: C.bg },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  fullModalTitle: { fontSize: 17, fontWeight: 'bold', color: C.primary },
  fullModalClose: { fontSize: 15, color: C.primary },
  fullModalScroll: { flex: 1 },
  fullModalContent: { padding: 16, paddingBottom: 40 },
  announceEmpty: { fontSize: 14, color: C.muted, textAlign: 'center', paddingTop: 48 },
  announceCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  announceCardNew: { borderColor: C.warning, borderWidth: 2 },
  announceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  announceDate: { fontSize: 12, color: C.muted },
  announceTitle: { fontSize: 15, fontWeight: 'bold', color: C.text, marginBottom: 6 },
  announceBody: { fontSize: 13, color: C.sub, lineHeight: 21 },
  inquiryLabel: { fontSize: 13, fontWeight: 'bold', color: C.sub, marginBottom: 8, marginTop: 12 },
  inquiryChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inquiryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  inquiryChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  inquiryChipText: { fontSize: 13, color: C.sub },
  inquiryChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  inquiryInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    minHeight: 160,
    lineHeight: 21,
  },
  inquiryNote: { fontSize: 11, color: C.muted, marginTop: 8 },
  inquirySubmitBtn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  inquirySubmitBtnDisabled: { opacity: 0.6 },
  inquirySubmitBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  inquiryMailLink: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  inquiryMailLinkText: { fontSize: 13, color: C.primary, textDecorationLine: 'underline' },
});
