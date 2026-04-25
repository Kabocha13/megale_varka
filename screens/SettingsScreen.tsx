import notifee, { AuthorizationStatus } from '@notifee/react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { hasRequestedHealthKit, isHealthKitAvailable } from '../services/healthService';
import {
  DEFAULT_REMINDER_DAYS,
  getReminderDays,
  saveReminderDays,
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
  const appState = useRef(AppState.currentState);

  const refreshPerms = useCallback(() => {
    fetchPermStatuses().then(setPerms).catch(() => {});
  }, []);

  useEffect(() => {
    getReminderDays().then(days => {
      setReminderDays(days);
      setDraft(days);
    }).catch(() => {});

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

  const handleLogoutPress = async () => {
    try {
      await logout();
    } catch {
      Alert.alert('エラー', 'ログアウトに失敗しました。もう一度お試しください。');
    }
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
            <Text style={s.rowLabel}>タスクリマインド</Text>
            <Text style={s.rowSub}>期限の何日前に通知するか（複数選択可）</Text>
          </View>
          <TouchableOpacity style={s.valueBtn} onPress={handleOpenPicker}>
            <Text style={s.valueBtnText} numberOfLines={1}>{daysLabel(reminderDays)}</Text>
            <Text style={s.arrow}>▼</Text>
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
});
