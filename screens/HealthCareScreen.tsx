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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  fetchTodayHealthKitData,
  isHealthKitAvailable,
} from '../services/healthService';

// --- Types ---
type Mood = 1 | 2 | 3 | 4 | 5;
type AppetiteLevel =
  | '普通に食べられる'
  | '少し食欲がない'
  | 'あまり食べられない'
  | '水なら飲める'
  | '何も摂れない';

// --- Constants ---
const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 5, emoji: '😊', label: 'とても良い' },
  { value: 4, emoji: '🙂', label: '良い' },
  { value: 3, emoji: '😐', label: '普通' },
  { value: 2, emoji: '😕', label: '悪い' },
  { value: 1, emoji: '😞', label: 'とても悪い' },
];

const SYMPTOMS = [
  '気分の落ち込み',
  'やる気が出ない',
  '集中できない',
  '疲れやすい',
  '不安・焦り感',
  '頭痛・頭重感',
  '体が重い',
  '涙が出る',
  '孤独感',
  '何もしたくない',
];

const APPETITE_LEVELS: AppetiteLevel[] = [
  '普通に食べられる',
  '少し食欲がない',
  'あまり食べられない',
  '水なら飲める',
  '何も摂れない',
];

// --- Helpers ---
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(day, 10)}日`;
}

function formatSleep(hours: number): string {
  const h = Math.floor(hours);
  const half = hours % 1 !== 0;
  if (h === 0 && half) { return '30分'; }
  if (half) { return `${h}時間30分`; }
  return `${h}時間`;
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
  const [appetite, setAppetite] = useState<AppetiteLevel | null>(null);
  const [alcohol, setAlcohol] = useState(false);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepSource, setSleepSource] = useState<'manual' | 'healthkit'>('manual');
  const [steps, setSteps] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (hkAvailable) {
          const hk = await fetchTodayHealthKitData();
          if (!cancelled) {
            if (hk.sleepHours !== null) {
              setSleepHours(hk.sleepHours);
              setSleepSource('healthkit');
            }
            setSteps(hk.steps);
            setActiveCalories(hk.activeCalories);
          }
        }
        if (uid) {
          const snap = await getDoc(doc(db, 'users', uid, 'healthRecords', today));
          if (!cancelled && snap.exists()) {
            const d = snap.data();
            setAlreadySaved(true);
            if (d.mood) { setMood(d.mood as Mood); }
            if (d.symptoms) { setSymptoms(d.symptoms); }
            if (d.appetite) { setAppetite(d.appetite as AppetiteLevel); }
            setAlcohol(d.alcohol ?? false);
            if (d.sleepHours !== undefined) { setSleepHours(d.sleepHours); }
            if (d.sleepSource) { setSleepSource(d.sleepSource); }
            if (d.steps !== undefined) { setSteps(d.steps); }
            if (d.activeCalories !== undefined) { setActiveCalories(d.activeCalories); }
          }
        }
      } catch (_) {
        // ignore load errors silently
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

  const adjustSleep = useCallback((delta: number) => {
    setSleepHours(prev => {
      const next = Math.round((prev + delta) * 2) / 2;
      return Math.max(0, Math.min(12, next));
    });
    setSleepSource('manual');
  }, []);

  const handleSave = async () => {
    if (!uid) { return; }
    if (!mood) {
      Alert.alert('今日の調子を選んでください', '5段階の顔文字から選んでください。');
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', uid, 'healthRecords', today), {
        date: today,
        mood,
        symptoms,
        appetite,
        alcohol,
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

      {/* Mood */}
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
      </View>

      {/* Appetite */}
      <Text style={s.sectionTitle}>食欲</Text>
      <View style={s.card}>
        {APPETITE_LEVELS.map((level, i) => (
          <TouchableOpacity
            key={level}
            style={[
              s.listOption,
              appetite === level && s.listOptionSelected,
              i < APPETITE_LEVELS.length - 1 && s.listOptionBorder,
            ]}
            onPress={() => setAppetite(level)}
            accessibilityRole="radio"
            accessibilityState={{ selected: appetite === level }}
          >
            <Text style={[s.listOptionText, appetite === level && s.listOptionTextSelected]}>
              {level}
            </Text>
            {appetite === level && <Text style={s.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
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

      {/* Sleep */}
      <Text style={s.sectionTitle}>睡眠時間</Text>
      <View style={s.card}>
        {sleepSource === 'healthkit' && (
          <Text style={s.hkBadge}>🍎 ヘルスケア連携</Text>
        )}
        <View style={s.stepperRow}>
          <TouchableOpacity
            style={[s.stepperBtn, sleepHours <= 0 && s.stepperBtnDisabled]}
            onPress={() => adjustSleep(-0.5)}
            disabled={sleepHours <= 0}
            accessibilityLabel="睡眠時間を30分減らす"
          >
            <Text style={s.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <View style={s.stepperValue}>
            <Text style={s.stepperValueText}>{formatSleep(sleepHours)}</Text>
          </View>
          <TouchableOpacity
            style={[s.stepperBtn, sleepHours >= 12 && s.stepperBtnDisabled]}
            onPress={() => adjustSleep(0.5)}
            disabled={sleepHours >= 12}
            accessibilityLabel="睡眠時間を30分増やす"
          >
            <Text style={s.stepperBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
        {sleepSource === 'manual' && (
          <Text style={s.hint}>30分単位で調整できます</Text>
        )}
      </View>

      {/* Exercise — HealthKit only */}
      {hkAvailable && (
        <>
          <Text style={s.sectionTitle}>運動</Text>
          <View style={s.card}>
            <Text style={s.hkBadge}>🍎 ヘルスケア連携</Text>
            <View style={s.exerciseRow}>
              <View style={s.exerciseItem}>
                <Text style={s.exerciseIcon}>👟</Text>
                <Text style={s.exerciseValue}>
                  {steps !== null ? steps.toLocaleString() : '---'}
                </Text>
                <Text style={s.exerciseUnit}>歩</Text>
              </View>
              <View style={s.exerciseDivider} />
              <View style={s.exerciseItem}>
                <Text style={s.exerciseIcon}>🔥</Text>
                <Text style={s.exerciseValue}>
                  {activeCalories !== null ? activeCalories.toLocaleString() : '---'}
                </Text>
                <Text style={s.exerciseUnit}>kcal</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Save */}
      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={alreadySaved ? '記録を更新する' : '記録する'}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={s.saveBtnText}>{alreadySaved ? '更新する' : '記録する'}</Text>
        )}
      </TouchableOpacity>

      <View style={s.bottomPad} />
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
  content: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 22, fontWeight: 'bold', color: C.primary },
  dateText: { fontSize: 13, color: C.sub },
  savedBadge: {
    marginTop: 4,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.sub,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  // Mood
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  moodBtnSelected: { backgroundColor: C.selected },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 9, color: C.muted, marginTop: 4, textAlign: 'center' },
  moodLabelSelected: { color: C.primary, fontWeight: 'bold' },

  // Symptoms
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FAFAFA',
  },
  tagSelected: { borderColor: C.primary, backgroundColor: C.selected },
  tagText: { fontSize: 13, color: C.text },
  tagTextSelected: { color: C.primary, fontWeight: 'bold' },
  hint: { fontSize: 12, color: C.muted, marginTop: 10 },

  // Appetite list
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  listOptionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  listOptionSelected: { backgroundColor: C.selected, borderRadius: 8, paddingHorizontal: 8 },
  listOptionText: { fontSize: 15, color: C.text },
  listOptionTextSelected: { color: C.primary, fontWeight: 'bold' },
  checkmark: { fontSize: 16, color: C.primary, fontWeight: 'bold' },

  // Alcohol toggle
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  toggleBtnText: { fontSize: 16, color: C.sub, fontWeight: '500' },
  toggleBtnTextActive: { color: '#FFF', fontWeight: 'bold' },

  // Sleep stepper
  hkBadge: { fontSize: 11, color: C.primary, marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { fontSize: 22, color: C.primary, fontWeight: 'bold', lineHeight: 26 },
  stepperValue: {
    minWidth: 110,
    alignItems: 'center',
  },
  stepperValueText: { fontSize: 24, fontWeight: 'bold', color: C.text },

  // Exercise
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  exerciseDivider: { width: 1, height: 50, backgroundColor: C.border },
  exerciseItem: { alignItems: 'center', flex: 1 },
  exerciseIcon: { fontSize: 24, marginBottom: 4 },
  exerciseValue: { fontSize: 22, fontWeight: 'bold', color: C.text },
  exerciseUnit: { fontSize: 13, color: C.muted },

  // Save button
  saveBtn: {
    marginTop: 28,
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },

  bottomPad: { height: 20 },
});
