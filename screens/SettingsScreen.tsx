import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DEFAULT_REMINDER_DAYS,
  getReminderDays,
  saveReminderDays,
} from '../services/notifications';
import { useAuth } from '../context/AuthContext';

const REMINDER_OPTIONS = [
  { label: '当日', days: 0 },
  { label: '1日前', days: 1 },
  { label: '2日前', days: 2 },
  { label: '3日前', days: 3 },
  { label: '1週間前', days: 7 },
  { label: '2週間前', days: 14 },
];

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    getReminderDays().then(setReminderDays).catch(() => {});
  }, []);

  const handleSelectDays = async (days: number) => {
    setReminderDays(days);
    setShowPicker(false);
    await saveReminderDays(days).catch(() => {});
  };

  const handleLogoutPress = async () => {
    try {
      await logout();
    } catch {
      Alert.alert('エラー', 'ログアウトに失敗しました。もう一度お試しください。');
    }
  };

  const currentLabel =
    REMINDER_OPTIONS.find(o => o.days === reminderDays)?.label ?? `${reminderDays}日前`;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>設定</Text>

      {/* リマインド設定 */}
      <Text style={s.sectionTitle}>通知・リマインド</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>タスクリマインド</Text>
            <Text style={s.rowSub}>期限の何日前に通知するか</Text>
          </View>
          <TouchableOpacity style={s.valueBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.valueBtnText}>{currentLabel}</Text>
            <Text style={s.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ログアウト */}
      <Text style={s.sectionTitle}>アカウント</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.logoutRow} onPress={handleLogoutPress}>
          <Text style={s.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* リマインド日数ピッカー */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>リマインドのタイミング</Text>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[s.pickerOption, reminderDays === opt.days && s.pickerOptionSelected]}
                onPress={() => handleSelectDays(opt.days)}
              >
                <Text style={[s.pickerOptionText, reminderDays === opt.days && s.pickerOptionTextSelected]}>
                  {opt.label}
                </Text>
                {reminderDays === opt.days && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={s.pickerCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
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
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  valueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  valueBtnText: { fontSize: 14, color: C.primary, fontWeight: 'bold', marginRight: 4 },
  arrow: { fontSize: 10, color: C.muted },
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
    width: '80%',
    padding: 16,
  },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: C.text, textAlign: 'center', marginBottom: 12 },
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
  check: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
  pickerCancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  pickerCancelText: { color: C.danger, fontSize: 15 },
});
