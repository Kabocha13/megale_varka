import DateTimePicker from '@react-native-community/datetimepicker';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  fetchHealthKitDataForDate,
  isHealthKitAvailable,
} from '../services/healthService';
import HealthStatsScreen from './HealthStatsScreen';

// --- Types ---
type Mood = 1 | 2 | 3 | 4 | 5;
type AppetiteValue = 'nothing' | 'water' | 'noodles' | 'set_meal' | 'steak';
type DailyAnswer = 'none' | 'little' | 'some' | 'always';
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// --- Constants ---
// Left=悪い, right=良い
const MOODS: { value: Mood; iconName: MaterialIconName; label: string }[] = [
  { value: 1, iconName: 'sentiment-very-dissatisfied', label: 'とても悪い' },
  { value: 2, iconName: 'sentiment-dissatisfied', label: '悪い' },
  { value: 3, iconName: 'sentiment-neutral', label: '普通' },
  { value: 4, iconName: 'sentiment-satisfied', label: '良い' },
  { value: 5, iconName: 'sentiment-very-satisfied', label: 'とても良い' },
];

const SYMPTOMS = [
  '気分の落ち込み',
  'やる気が出ない',
  '体の重さ・疲れ',
  '集中できない',
  'その他',
];

const APPETITE_OPTIONS: { value: AppetiteValue; iconName: MaterialIconName; label: string }[] = [
  { value: 'nothing',  iconName: 'no-meals', label: '食べれない' },
  { value: 'water',    iconName: 'opacity', label: '水' },
  { value: 'noodles',  iconName: 'ramen-dining', label: '麺類' },
  { value: 'set_meal', iconName: 'set-meal', label: '定食' },
  { value: 'steak',    iconName: 'dinner-dining', label: 'ステーキ' },
];

// CES-D style daily check-in questions. One is shown per day, deterministically
// selected from the date so the question is stable within the same day.
const DAILY_QUESTIONS: string[] = [
  '普段は何でもないことが煩わしいと思う',
  '食べたくない、食欲が落ちたと思う',
  '家族や友達から励まされても気が晴れない',
  '他人と同じ程度には能力があると思う',
  '物事に集中できない',
  'ゆううつだと感じる',
  '何をするのも面倒だと感じる',
  'これからのことを積極的に考えられる',
  '過去のことについてくよくよ考える',
  '何か恐ろしい気持ちがする',
  'なかなか眠れない',
  '生活について不満なく過ごせている',
  '普段より口数が少ない',
  'ひとりぼっちで寂しい',
  'みながよそよそしいと感じる',
  '毎日が楽しいと感じる',
  '急に泣き出したくなる',
  '悲しいと感じる',
  'みなが自分を嫌っていると感じる',
  '仕事や勉強が手につかない',
];

const DAILY_ANSWER_OPTIONS: { value: DailyAnswer; label: string }[] = [
  { value: 'none',   label: '全くない' },
  { value: 'little', label: '少しある' },
  { value: 'some',   label: 'かなりある' },
  { value: 'always', label: 'いつもある' },
];

function dailyQuestionIndex(dateStr: string): number {
  // Hash the date string so the rotation isn't a simple last-digit pattern.
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % DAILY_QUESTIONS.length;
}

// --- Helpers ---
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStringFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Retroactive entry window — user can fill up to 3 previous days.
const DATE_PILLS: { offset: number; label: string }[] = [
  { offset: 0, label: '今日' },
  { offset: 1, label: '昨日' },
  { offset: 2, label: '2日前' },
  { offset: 3, label: '3日前' },
];

function formatDate(s: string): string {
  if (typeof s !== 'string' || !s) { return ''; }
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
  const d = new Date();
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) { return d; }
  const [h, m] = hhmm.split(':').map(Number);
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
  const [existingIsRetroactive, setExistingIsRetroactive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

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
  const [dailyAnswer, setDailyAnswer] = useState<DailyAnswer | null>(null);
  const [showAnswerPicker, setShowAnswerPicker] = useState(false);

  const dailyQuestion = DAILY_QUESTIONS[dailyQuestionIndex(selectedDate)];

  const isRetroactive = selectedDate !== today;

  // Slide-up animation: when a record exists for today, the form is pushed
  // off-screen (upwards, curtain-style) revealing the stats view behind it.
  const screenH = Dimensions.get('window').height;
  const slideY = useRef(new Animated.Value(0)).current;
  const [showStats, setShowStats] = useState(false);
  const [statsKey, setStatsKey] = useState(0); // remount to refresh after edit-save
  // True once any record (today or past) has been seen / saved — gates
  // visibility of the back-to-stats button.
  const [statsAvailable, setStatsAvailable] = useState(false);
  // Auto-slide to stats only on the very first load. Subsequent date-pill
  // changes should NOT pull the user back to stats.
  const initialLoadDoneRef = useRef(false);

  const animateFormOut = useCallback(() => {
    setShowStats(true);
    Animated.timing(slideY, {
      toValue: -screenH,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideY, screenH]);

  const animateFormIn = useCallback(() => {
    Animated.timing(slideY, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShowStats(false));
  }, [slideY]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Reset form to defaults so switching dates doesn't carry stale values.
      setAlreadySaved(false);
      setExistingIsRetroactive(false);
      setMood(null);
      setSymptoms([]);
      setOtherNote('');
      setAppetite(null);
      setAlcohol(false);
      setBedTime(mkBedTime());
      setWakeTime(mkWakeTime());
      setSleepSource('manual');
      setSteps(null);
      setActiveCalories(null);
      setDailyAnswer(null);
      try {
        // HealthKit target date:
        //   - For today's form, today isn't finished yet, so we use yesterday.
        //   - For retroactive forms, the target day is already complete, so
        //     we use the selected day itself.
        const hkTargetDate =
          selectedDate === today ? dateStringFromOffset(1) : selectedDate;
        if (hkAvailable) {
          const hk = await fetchHealthKitDataForDate(hkTargetDate);
          if (!cancelled) {
            if (hk.sleepStart && hk.sleepEnd) {
              setBedTime(hk.sleepStart);
              setWakeTime(hk.sleepEnd);
              setSleepSource('healthkit');
            }
            setSteps(hk.steps);
            setActiveCalories(hk.activeCalories);
          }
        }
        if (uid) {
          const snap = await getDoc(doc(db, 'users', uid, 'healthRecords', selectedDate));
          if (!cancelled && snap.exists()) {
            const data = snap.data();
            setAlreadySaved(true);
            setExistingIsRetroactive(data.isRetroactive === true);
            setStatsAvailable(true);
            if (data.mood) { setMood(data.mood as Mood); }
            if (data.symptoms) { setSymptoms(data.symptoms); }
            if (data.otherNote) { setOtherNote(data.otherNote); }
            if (data.appetite) { setAppetite(data.appetite as AppetiteValue); }
            setAlcohol(data.alcohol ?? false);
            if (data.bedTime) { setBedTime(strToDate(data.bedTime)); }
            if (data.wakeTime) { setWakeTime(strToDate(data.wakeTime)); }
            if (data.sleepSource) { setSleepSource(data.sleepSource); }
            if (data.steps !== undefined && data.steps !== null) { setSteps(data.steps); }
            if (data.activeCalories !== undefined && data.activeCalories !== null) {
              setActiveCalories(data.activeCalories);
            }
            if (data.dailyAnswer) { setDailyAnswer(data.dailyAnswer as DailyAnswer); }
            // Initial mount only: if today is already recorded, start in
            // stats view. Subsequent date-pill changes must NOT pull the
            // user back to stats.
            if (selectedDate === today && !initialLoadDoneRef.current) {
              slideY.setValue(-screenH);
              setShowStats(true);
            }
          }
        }
      } catch {
        // silently ignore load errors
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoadDoneRef.current = true;
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [uid, today, selectedDate, hkAvailable, slideY, screenH]);

  const toggleSymptom = useCallback((sym: string) => {
    setSymptoms(prev =>
      prev.includes(sym) ? prev.filter(x => x !== sym) : [...prev, sym],
    );
  }, []);


  const handleSave = async () => {
    if (!uid) { return; }
    if (!mood) {
      Alert.alert('調子を選んでください', '5段階の顔文字から選んでください。');
      return;
    }
    setSaving(true);
    const sleepHours = calcSleepHours(bedTime, wakeTime);
    const shouldExcludeFromStreak = isRetroactive && (!alreadySaved || existingIsRetroactive);
    try {
      await setDoc(doc(db, 'users', uid, 'healthRecords', selectedDate), {
        date: selectedDate,
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
        dailyAnswer,
        isRetroactive: shouldExcludeFromStreak,
        updatedAt: serverTimestamp(),
      });
      setAlreadySaved(true);
      setExistingIsRetroactive(shouldExcludeFromStreak);
      setStatsAvailable(true);
      setStatsKey(k => k + 1); // force stats refresh next reveal
      if (isRetroactive) {
        // Past-day save: return to today's view. The load effect will slide
        // up to the stats screen if today is already recorded.
        Alert.alert('保存しました', `${formatDate(selectedDate)}の記録を保存しました。`);
        setSelectedDate(today);
      } else {
        animateFormOut();
      }
    } catch {
      Alert.alert('エラー', '保存に失敗しました。再度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = useCallback(() => {
    animateFormIn();
  }, [animateFormIn]);

  const handleBack = useCallback(() => {
    setSelectedDate(today);
    animateFormOut();
  }, [today, animateFormOut]);

  const sleepDuration = calcSleepHours(bedTime, wakeTime);

  return (
    <View style={s.container}>
      {/* Stats view lives behind the form; mounted lazily to save work. */}
      {showStats && uid && (
        <View style={s.statsLayer}>
          <HealthStatsScreen key={statsKey} uid={uid} onEdit={handleEdit} />
        </View>
      )}

      <Animated.View
        style={[s.formLayer, { transform: [{ translateY: slideY }] }]}
      >
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        )}
        <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>健康記録</Text>
          <Text style={s.dateText}>{formatDate(selectedDate)}</Text>
          {alreadySaved && (
            <View style={s.savedBadge}>
              <MaterialIcons name="check" size={12} color="#2E7D32" />
              <Text style={s.savedBadgeText}>記録済み</Text>
            </View>
          )}
        </View>
        {statsAvailable && (
          <TouchableOpacity
            style={s.backBtn}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="戻る"
          >
            <Text style={s.backBtnText}>← 戻る</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date pills — up to 3 retroactive days */}
      <View style={s.datePillRow}>
        {DATE_PILLS.map(p => {
          const pillDate = dateStringFromOffset(p.offset);
          const selected = selectedDate === pillDate;
          return (
            <TouchableOpacity
              key={p.offset}
              style={[s.datePill, selected && s.datePillSelected]}
              onPress={() => setSelectedDate(pillDate)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[s.datePillText, selected && s.datePillTextSelected]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isRetroactive && (
        <View style={s.retroBanner}>
          <Text style={s.retroBannerText}>
            {alreadySaved && !existingIsRetroactive
              ? '過去の記録を更新中です。連続記録は維持されます。'
              : '遡って記録中です。連続記録には加算されません。'}
          </Text>
        </View>
      )}

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
              <MaterialIcons
                name={m.iconName}
                size={26}
                color={mood === m.value ? C.primary : C.muted}
                style={s.optionIcon}
              />
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

      {/* Daily rotating check-in question */}
      <Text style={s.sectionTitle}>今日の一問</Text>
      <View style={s.card}>
        <Text style={s.questionText}>Q. {dailyQuestion}</Text>
        <TouchableOpacity
          style={s.dropdown}
          onPress={() => setShowAnswerPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="回答を選択"
        >
          <Text style={[
            s.dropdownText,
            !dailyAnswer && s.dropdownPlaceholder,
          ]}>
            {dailyAnswer
              ? DAILY_ANSWER_OPTIONS.find(o => o.value === dailyAnswer)?.label
              : '選択してください'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={C.sub} />
        </TouchableOpacity>
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
              <MaterialIcons
                name={opt.iconName}
                size={25}
                color={appetite === opt.value ? C.primary : C.muted}
                style={s.optionIcon}
              />
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
          <View style={s.hkBadge}>
            <MaterialIcons name="apple" size={12} color={C.primary} />
            <Text style={s.hkBadgeText}>ヘルスケア連携</Text>
          </View>
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
          <MaterialIcons name="arrow-forward" size={18} color={C.muted} style={s.sleepArrow} />
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
            <View style={s.hkBadge}>
              <MaterialIcons name="apple" size={12} color={C.primary} />
              <Text style={s.hkBadgeText}>
                {isRetroactive ? `${formatDate(selectedDate)}のデータ` : '昨日のデータ'}
              </Text>
            </View>
            <View style={s.exerciseRow}>
              <View style={s.exerciseItem}>
                <MaterialIcons name="directions-walk" size={22} color={C.primary} style={s.exerciseIcon} />
                <Text style={s.exerciseValue}>{steps?.toLocaleString() ?? '---'}</Text>
                <Text style={s.exerciseUnit}>歩</Text>
              </View>
              <View style={s.exerciseDivider} />
              <View style={s.exerciseItem}>
                <MaterialIcons name="local-fire-department" size={22} color="#B8683B" style={s.exerciseIcon} />
                <Text style={s.exerciseValue}>{activeCalories?.toLocaleString() ?? '---'}</Text>
                <Text style={s.exerciseUnit}>kcal</Text>
              </View>
            </View>
          </>
        ) : hkAvailable ? (
          <View style={s.hkOffPrompt}>
            <MaterialIcons name="apple" size={26} color={C.primary} style={s.hkOffIcon} />
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

      {/* Answer pulldown — simple bottom sheet with the 4 choices */}
      {showAnswerPicker && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowAnswerPicker(false)}
        >
          <TouchableOpacity
            style={s.answerOverlay}
            activeOpacity={1}
            onPress={() => setShowAnswerPicker(false)}
          >
            <View style={s.answerSheet}>
              <Text style={s.answerSheetTitle}>回答を選択</Text>
              {DAILY_ANSWER_OPTIONS.map(opt => {
                const selected = dailyAnswer === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.answerOption, selected && s.answerOptionSelected]}
                    onPress={() => {
                      setDailyAnswer(opt.value);
                      setShowAnswerPicker(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.answerOptionText, selected && s.answerOptionTextSelected]}>
                      {opt.label}
                    </Text>
                    {selected && <MaterialIcons name="check" size={18} color={C.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
        </ScrollView>
      </Animated.View>
    </View>
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

  statsLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  formLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.bg,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
    zIndex: 10,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  dateText: { fontSize: 12, color: C.sub, marginTop: 2 },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  savedBadgeText: { fontSize: 11, color: '#2E7D32', fontWeight: 'bold' },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.selected,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { fontSize: 12, color: C.primary, fontWeight: 'bold' },

  datePillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  datePillSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  datePillText: { fontSize: 12, color: C.sub },
  datePillTextSelected: { color: '#FFF', fontWeight: 'bold' },

  retroBanner: {
    backgroundColor: '#FFF6EC',
    borderColor: '#E8C9A0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  retroBannerText: {
    fontSize: 11,
    color: '#8A5A1E',
  },

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
  optionIcon: { marginBottom: 2 },
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

  // Daily question
  questionText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: { fontSize: 14, color: C.text },
  dropdownPlaceholder: { color: C.muted },

  answerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  answerSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 10,
    paddingBottom: 24,
  },
  answerSheetTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: C.sub,
    textAlign: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  answerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  answerOptionSelected: { backgroundColor: C.selected },
  answerOptionText: { fontSize: 15, color: C.text },
  answerOptionTextSelected: { color: C.primary, fontWeight: 'bold' },

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
  hkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  hkBadgeText: { fontSize: 10, color: C.primary },
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
  sleepArrow: { marginTop: 10 },
  sleepDurationBlock: { alignItems: 'center' },
  sleepDurationText: { fontSize: 16, fontWeight: 'bold', color: C.text },

  // Exercise
  hkOffPrompt: { alignItems: 'center', paddingVertical: 6, gap: 4 },
  hkOffIcon: { marginBottom: 2 },
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
  exerciseIcon: { marginBottom: 2 },
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
