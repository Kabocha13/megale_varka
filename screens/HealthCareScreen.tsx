import DateTimePicker from '@react-native-community/datetimepicker';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  fetchYesterdayHealthKitData,
  isHealthKitAvailable,
} from '../services/healthService';

// --- Types ---
type Mood = 1 | 2 | 3 | 4 | 5;
type AppetiteValue = 'nothing' | 'water' | 'noodles' | 'set_meal' | 'steak';

// --- Constants ---
// Left=悪い, right=良い
const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'とても悪い' },
  { value: 2, emoji: '😕', label: '悪い' },
  { value: 3, emoji: '😐', label: '普通' },
  { value: 4, emoji: '🙂', label: '良い' },
  { value: 5, emoji: '😊', label: 'とても良い' },
];

const SYMPTOMS = [
  '気分の落ち込み',
  'やる気が出ない',
  '体の重さ・疲れ',
  '集中できない',
  'その他',
];

const APPETITE_OPTIONS: { value: AppetiteValue; emoji: string; label: string }[] = [
  { value: 'nothing',  emoji: '🚫', label: '食べれない' },
  { value: 'water',    emoji: '💧', label: '水' },
  { value: 'noodles',  emoji: '🍜', label: '麺類' },
  { value: 'set_meal', emoji: '🍱', label: '定食' },
  { value: 'steak',    emoji: '🥩', label: 'ステーキ' },
];

// --- Helpers ---
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

function formatTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function strToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function calcSleepHours(bed: Date, wake: Date): number {
  let ms = wake.getTime() - bed.getTime();
  if (ms < 0) { ms += 24 * 60 * 60 * 1000; } // cross midnight
  return ms / (1000 * 60 * 60);
}

function formatDuration(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function mkBedTime(): Date {
  const d = new Date();
  d.setHours(23, 0, 0, 0);
  return d;
}

function mkWakeTime(): Date {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  return d;
}

// --- Component ---
export default function HealthCareScreen() {
  const { uid } = useAuth();
  const today = todayString();
  const hkAvailable = isHealthKitAvailable();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);

  const [mood, setMood] = useState<Mood | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState('');
  const [appetite, setAppetite] = useState<AppetiteValue | null>(null);
  const [alcohol, setAlcohol] = useState(false);
  const [bedTime, setBedTime] = useState<Date>(mkBedTime);
  const [wakeTime, setWakeTime] = useState<Date>(mkWakeTime);
  const [sleepSource, setSleepSource] = useState<'manual' | 'healthkit'>('manual');
  const [steps, setSteps] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState<number | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'bed' | 'wake' | null>(null);
  const [tempPickerTime, setTempPickerTime] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (hkAvailable) {
          const hk = await fetchYesterdayHealthKitData();
          if (!cancelled) {
            if (hk.sleepHours !== null) {
              // `sleepHours` is only a duration and does not provide actual
              // bed/wake timestamps. Keep the current/default times unchanged
              // unless real start/end timestamps are available.
              setSleepSource('healthkit');
            }
            setSteps(hk.steps);
            setActiveCalories(hk.activeCalories);
          }
        }
        if (uid) {
          const snap = await getDoc(doc(db, 'users', uid, 'healthRecords', today));
          if (!cancelled && snap.exists()) {
            const data = snap.data();
            setAlreadySaved(true);
            if (data.mood) { setMood(data.mood as Mood); }
            if (data.symptoms) { setSymptoms(data.symptoms); }
            if (data.otherNote) { setOtherNote(data.otherNote); }
            if (data.appetite) { setAppetite(data.appetite as AppetiteValue); }
            setAlcohol(data.alcohol ?? false);
            if (data.bedTime) { setBedTime(strToDate(data.bedTime)); }
            if (data.wakeTime) { setWakeTime(strToDate(data.wakeTime)); }
            if (data.sleepSource) { setSleepSource(data.sleepSource); }
            if (data.steps !== undefined) { setSteps(data.steps); }
            if (data.activeCalories !== undefined) { setActiveCalories(data.activeCalories); }
          }
        }
      } catch (_) {
        // silently ignore load errors
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [uid, today, hkAvailable]);

  const toggleSymptom = useCallback((sym: string) => {
    setSymptoms(prev =>
      prev.includes(sym) ? prev.filter(x => x !== sym) : [...prev, sym],
    );
  }, []);


  const handleSave = async () => {
    if (!uid) { return; }
    if (!mood) {
      Alert.alert('今日の調子を選んでください', '5段階の顔文字から選んでください。');
      return;
    }
    setSaving(true);
    const sleepHours = calcSleepHours(bedTime, wakeTime);
    try {
      await setDoc(doc(db, 'users', uid, 'healthRecords', today), {
        date: today,
        mood,
        symptoms,
        otherNote: symptoms.includes('その他') ? otherNote : '',
        appetite,
        alcohol,
        bedTime: timeToStr(bedTime),
        wakeTime: timeToStr(wakeTime),
        sleepHours,
        sleepSource,
        steps,
        activeCalories,
        updatedAt: serverTimestamp(),
      });
      setAlreadySaved(true);
      Alert.alert('保存しました', '今日の健康記録を保存しました。');
    } catch (_) {
      Alert.alert('エラー', '保存に失敗しました。再度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const sleepDuration = calcSleepHours(bedTime, wakeTime);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>健康記録</Text>
        <View style={s.headerRight}>
          <Text style={s.dateText}>{formatDate(today)}</Text>
          {alreadySaved && <Text style={s.savedBadge}>✓ 記録済み</Text>}
        </View>
      </View>

      {/* Mood — left=悪い, right=良い */}
      <Text style={s.sectionTitle}>今日の調子</Text>
      <View style={s.card}>
        <View style={s.moodRow}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[s.moodBtn, mood === m.value && s.moodBtnSelected]}
              onPress={() => setMood(m.value)}
              accessibilityLabel={m.label}
              accessibilityRole="button"
              accessibilityState={{ selected: mood === m.value }}
            >
              <Text style={s.moodEmoji}>{m.emoji}</Text>
              <Text style={[s.moodLabel, mood === m.value && s.moodLabelSelected]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Symptoms */}
      <Text style={s.sectionTitle}>気になる症状</Text>
      <View style={s.card}>
        <View style={s.tagGrid}>
          {SYMPTOMS.map(sym => {
            const sel = symptoms.includes(sym);
            return (
              <TouchableOpacity
                key={sym}
                style={[s.tag, sel && s.tagSelected]}
                onPress={() => toggleSymptom(sym)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
              >
                <Text style={[s.tagText, sel && s.tagTextSelected]}>{sym}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {symptoms.length === 0 && (
          <Text style={s.hint}>なければ選択不要です</Text>
        )}
        {symptoms.includes('その他') && (
          <TextInput
            style={s.otherInput}
            value={otherNote}
            onChangeText={setOtherNote}
            placeholder="その他の症状を入力してください"
            placeholderTextColor={C.muted}
            multiline
            maxLength={200}
          />
        )}
      </View>

      {/* Appetite */}
      <Text style={s.sectionTitle}>食欲レベル</Text>
      <View style={s.card}>
        <View style={s.appetiteRow}>
          {APPETITE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.appetiteBtn, appetite === opt.value && s.appetiteBtnSelected]}
              onPress={() => setAppetite(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: appetite === opt.value }}
            >
              <Text style={s.appetiteEmoji}>{opt.emoji}</Text>
              <Text style={[s.appetiteLabel, appetite === opt.value && s.appetiteLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Alcohol */}
      <Text style={s.sectionTitle}>アルコール</Text>
      <View style={s.card}>
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, !alcohol && s.toggleBtnActive]}
            onPress={() => setAlcohol(false)}
            accessibilityRole="radio"
            accessibilityState={{ selected: !alcohol }}
          >
            <Text style={[s.toggleBtnText, !alcohol && s.toggleBtnTextActive]}>なし</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, alcohol && s.toggleBtnActive]}
            onPress={() => setAlcohol(true)}
            accessibilityRole="radio"
            accessibilityState={{ selected: alcohol }}
          >
            <Text style={[s.toggleBtnText, alcohol && s.toggleBtnTextActive]}>あり</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sleep — bed/wake time pickers */}
      <Text style={s.sectionTitle}>睡眠時間</Text>
      <View style={s.card}>
        {sleepSource === 'healthkit' && (
          <Text style={s.hkBadge}>🍎 ヘルスケア連携</Text>
        )}
        <View style={s.sleepRow}>
          <View style={s.sleepTimeBlock}>
            <Text style={s.sleepTimeLabel}>就寝</Text>
            <TouchableOpacity
              style={s.sleepTimeBtn}
              onPress={() => { setTempPickerTime(bedTime); setShowTimePicker('bed'); }}
            >
              <Text style={s.sleepTimeText}>{formatTime(bedTime)}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.sleepArrow}>→</Text>
          <View style={s.sleepTimeBlock}>
            <Text style={s.sleepTimeLabel}>起床</Text>
            <TouchableOpacity
              style={s.sleepTimeBtn}
              onPress={() => { setTempPickerTime(wakeTime); setShowTimePicker('wake'); }}
            >
              <Text style={s.sleepTimeText}>{formatTime(wakeTime)}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.sleepDurationBlock}>
            <Text style={s.sleepTimeLabel}>合計</Text>
            <Text style={s.sleepDurationText}>{formatDuration(sleepDuration)}</Text>
          </View>
        </View>
      </View>

      {/* Exercise */}
      <Text style={s.sectionTitle}>運動</Text>
      <View style={s.card}>
        {steps !== null || activeCalories !== null ? (
          <>
            <Text style={s.hkBadge}>🍎 昨日のデータ</Text>
            <View style={s.exerciseRow}>
              <View style={s.exerciseItem}>
                <Text style={s.exerciseIcon}>👟</Text>
                <Text style={s.exerciseValue}>{steps?.toLocaleString() ?? '---'}</Text>
                <Text style={s.exerciseUnit}>歩</Text>
              </View>
              <View style={s.exerciseDivider} />
              <View style={s.exerciseItem}>
                <Text style={s.exerciseIcon}>🔥</Text>
                <Text style={s.exerciseValue}>{activeCalories?.toLocaleString() ?? '---'}</Text>
                <Text style={s.exerciseUnit}>kcal</Text>
              </View>
            </View>
          </>
        ) : hkAvailable ? (
          <View style={s.hkOffPrompt}>
            <Text style={s.hkOffIcon}>🍎</Text>
            <Text style={s.hkOffTitle}>ヘルスケア連携がオフです</Text>
            <Text style={s.hkOffSub}>
              設定 › プライバシーとセキュリティ › ヘルスケア{'\n'}
              からこのアプリをオンにしてください。
            </Text>
          </View>
        ) : (
          <Text style={s.hkUnavailableText}>運動データの連携はiOSのみ利用可能です</Text>
        )}
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={s.saveBtnText}>{alreadySaved ? '更新する' : '記録する'}</Text>
        )}
      </TouchableOpacity>

      <View style={s.bottomPad} />

      {/* Time Picker — iOS: bottom sheet modal, Android: native dialog */}
      {Platform.OS === 'ios' && showTimePicker !== null && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => { setTempPickerTime(null); setShowTimePicker(null); }}
        >
          <View style={s.overlay}>
            <View style={s.pickerCard}>
              <View style={s.pickerHeader}>
                <TouchableOpacity onPress={() => { setTempPickerTime(null); setShowTimePicker(null); }}>
                  <Text style={s.pickerCancelText}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={s.pickerTitle}>
                  {showTimePicker === 'bed' ? '就寝時刻' : '起床時刻'}
                </Text>
                <TouchableOpacity onPress={() => {
                  if (tempPickerTime !== null) {
                    if (showTimePicker === 'bed') { setBedTime(tempPickerTime); }
                    else { setWakeTime(tempPickerTime); }
                    setSleepSource('manual');
                  }
                  setTempPickerTime(null);
                  setShowTimePicker(null);
                }}>
                  <Text style={s.pickerDoneText}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempPickerTime ?? (showTimePicker === 'bed' ? bedTime : wakeTime)}
                mode="time"
                display="spinner"
                locale="ja"
                onChange={(_, date) => {
                  if (date) { setTempPickerTime(date); }
                }}
              />
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === 'android' && showTimePicker !== null && (
        <DateTimePicker
          value={showTimePicker === 'bed' ? bedTime : wakeTime}
          mode="time"
          display="default"
          onChange={(_, date) => {
            setShowTimePicker(null);
            if (date) {
              if (showTimePicker === 'bed') { setBedTime(date); }
              else { setWakeTime(date); }
              setSleepSource('manual');
            }
          }}
        />
      )}
    </ScrollView>
  );
}

// --- Design tokens ---
const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  card: '#FFFFFF',
  border: '#D9D0C8',
  text: '#333333',
  sub: '#555555',
  muted: '#A8BDD4',
  selected: '#EBF0F8',
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 14, paddingBottom: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  dateText: { fontSize: 12, color: C.sub },
  savedBadge: { marginTop: 2, fontSize: 11, color: '#2E7D32', fontWeight: 'bold' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: C.sub,
    marginBottom: 5,
    marginTop: 10,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  // Mood
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  moodBtnSelected: { backgroundColor: C.selected },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 9, color: C.muted, marginTop: 3, textAlign: 'center' },
  moodLabelSelected: { color: C.primary, fontWeight: 'bold' },

  // Symptoms
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FAFAFA',
  },
  tagSelected: { borderColor: C.primary, backgroundColor: C.selected },
  tagText: { fontSize: 12, color: C.text },
  tagTextSelected: { color: C.primary, fontWeight: 'bold' },
  hint: { fontSize: 11, color: C.muted, marginTop: 6 },
  otherInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: C.text,
    minHeight: 50,
    textAlignVertical: 'top',
  },

  // Appetite
  appetiteRow: { flexDirection: 'row', justifyContent: 'space-between' },
  appetiteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  appetiteBtnSelected: { backgroundColor: C.selected },
  appetiteEmoji: { fontSize: 24 },
  appetiteLabel: { fontSize: 9, color: C.muted, marginTop: 3, textAlign: 'center' },
  appetiteLabelSelected: { color: C.primary, fontWeight: 'bold' },
  checkmark: { fontSize: 14, color: C.primary, fontWeight: 'bold' },

  // Alcohol
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  toggleBtnText: { fontSize: 14, color: C.sub, fontWeight: '500' },
  toggleBtnTextActive: { color: '#FFF', fontWeight: 'bold' },

  // Sleep
  hkBadge: { fontSize: 10, color: C.primary, marginBottom: 4 },
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sleepTimeBlock: { alignItems: 'center' },
  sleepTimeLabel: { fontSize: 10, color: C.muted, marginBottom: 3 },
  sleepTimeBtn: {
    backgroundColor: C.selected,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  sleepTimeText: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  sleepArrow: { fontSize: 16, color: C.muted, marginTop: 10 },
  sleepDurationBlock: { alignItems: 'center' },
  sleepDurationText: { fontSize: 16, fontWeight: 'bold', color: C.text },

  // Exercise
  hkOffPrompt: { alignItems: 'center', paddingVertical: 6, gap: 4 },
  hkOffIcon: { fontSize: 24, marginBottom: 2 },
  hkOffTitle: { fontSize: 13, fontWeight: 'bold', color: C.primary },
  hkOffSub: { fontSize: 11, color: C.sub, textAlign: 'center', lineHeight: 18 },
  hkUnavailableText: { fontSize: 12, color: C.muted, textAlign: 'center', paddingVertical: 6 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  exerciseDivider: { width: 1, height: 44, backgroundColor: C.border },
  exerciseItem: { alignItems: 'center', flex: 1 },
  exerciseIcon: { fontSize: 20, marginBottom: 2 },
  exerciseValue: { fontSize: 20, fontWeight: 'bold', color: C.text },
  exerciseUnit: { fontSize: 12, color: C.muted },

  // Save
  saveBtn: {
    marginTop: 14,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  bottomPad: { height: 8 },

  // Time picker modal (iOS bottom sheet)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: C.text },
  pickerCancelText: { fontSize: 15, color: C.muted },
  pickerDoneText: { fontSize: 15, color: C.primary, fontWeight: 'bold' },
});
