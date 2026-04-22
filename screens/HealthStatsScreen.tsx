import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import LineChart, { LinePoint } from '../components/charts/LineChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import StackedBar, { StackSegment } from '../components/charts/StackedBar';
import { AppetiteValue, fetchHealthStats, HealthStats } from '../services/statsService';

interface Props {
  uid: string;
  onEdit?: () => void;
}

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const APPETITE_META: Record<AppetiteValue, { label: string; iconName: MaterialIconName; color: string }> = {
  nothing:  { label: '食べれない', iconName: 'no-meals', color: '#C77D7D' },
  water:    { label: '水',         iconName: 'opacity', color: '#7FA8D0' },
  noodles:  { label: '麺類',       iconName: 'ramen-dining', color: '#E0B877' },
  set_meal: { label: '定食',       iconName: 'set-meal', color: '#6EA56E' },
  steak:    { label: 'ステーキ',   iconName: 'dinner-dining', color: '#8E5A3C' },
};

function shortDayLabel(dateStr: string): string {
  // "2026-04-19" → "4/19"
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function buildContinuousWindow(
  records: HealthStats['records'],
  days: number,
): { date: string; record: HealthStats['records'][number] | undefined }[] {
  const map = new Map(records.map(r => [r.date, r]));
  const out: { date: string; record: HealthStats['records'][number] | undefined }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ date: key, record: map.get(key) });
  }
  return out;
}

function buildSymptomFrequencies(
  records: HealthStats['records'],
  days: number,
): { label: string; value: number; valueLabel: string }[] {
  const symMap = new Map<string, number>();

  records.forEach(record => {
    (record.symptoms ?? []).forEach(symptom => {
      symMap.set(symptom, (symMap.get(symptom) ?? 0) + 1);
    });
  });

  return Array.from(symMap.entries())
    .map(([label, value]) => ({
      label,
      value,
      valueLabel: `${value}日 ${Math.round((value / days) * 100)}%`,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'ja'));
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) { return null; }
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function calculateHealthScore(
  records: HealthStats['records'],
  days: number,
  avgMood: number | null,
  avgSleepHours: number | null,
): number {
  if (records.length === 0) { return 0; }

  const recordScore = (records.length / days) * 100;
  const moodScore = avgMood !== null ? ((avgMood - 1) / 4) * 100 : 50;
  const sleepScore = avgSleepHours !== null
    ? (1 - Math.min(Math.abs(avgSleepHours - 7.5) / 7.5, 1)) * 100
    : 50;
  const symptomScore = (
    records.reduce((sum, record) => sum + (record.symptoms?.length ?? 0), 0) / days
  );
  const normalizedSymptomScore = clamp(100 - symptomScore * 25, 0, 100);
  const noAlcoholScore = (records.filter(record => record.alcohol !== true).length / records.length) * 100;

  return Math.round(
    recordScore * 0.2
    + moodScore * 0.3
    + sleepScore * 0.25
    + normalizedSymptomScore * 0.15
    + noAlcoholScore * 0.1,
  );
}

export default function HealthStatsScreen({ uid, onEdit }: Props) {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await fetchHealthStats(uid, 30);
        if (!cancelled) { setStats(s); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  if (loading || !stats) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const windowed = buildContinuousWindow(stats.records, windowDays);

  const moodPoints: LinePoint[] = windowed.map(w => ({
    label: shortDayLabel(w.date),
    value: typeof w.record?.mood === 'number' ? w.record.mood : null,
  }));

  const sleepPoints: LinePoint[] = windowed.map(w => ({
    label: shortDayLabel(w.date),
    value: typeof w.record?.sleepHours === 'number' && w.record.sleepHours > 0
      ? w.record.sleepHours
      : null,
  }));

  const appetiteStack: StackSegment[] = (Object.keys(APPETITE_META) as AppetiteValue[]).map(k => ({
    label: APPETITE_META[k].label,
    iconName: APPETITE_META[k].iconName,
    color: APPETITE_META[k].color,
    value: stats.appetiteCounts[k],
  }));

  const alcoholInWindow = windowed.filter(w => w.record?.alcohol === true).length;
  const recordsInWindow = windowed
    .map(w => w.record)
    .filter((record): record is HealthStats['records'][number] => Boolean(record));
  const avgMoodInWindow = avg(
    recordsInWindow
      .map(record => record.mood)
      .filter((value): value is number => typeof value === 'number'),
  );
  const avgSleepInWindow = avg(
    recordsInWindow
      .map(record => record.sleepHours)
      .filter((value): value is number => typeof value === 'number' && value > 0),
  );
  const healthScore = calculateHealthScore(
    recordsInWindow,
    windowDays,
    avgMoodInWindow,
    avgSleepInWindow,
  );
  const jobSearchScore = 13;
  const overallScore = Math.round((healthScore + jobSearchScore) / 2);
  const symptomFrequencies = buildSymptomFrequencies(
    recordsInWindow,
    windowDays,
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>健康統計</Text>
        {onEdit && (
          <TouchableOpacity onPress={() => onEdit()} style={s.editBtn}>
            <Text style={s.editBtnText}>記録を編集</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, s.streakCard]}>
          <MaterialIcons name="analytics" size={24} color={C.primary} style={s.summaryIcon} />
          <Text style={s.summaryValue}>{overallScore}</Text>
          <Text style={s.summaryLabel}>総合スコア</Text>
        </View>
        <View style={s.summaryCard}>
          <MaterialIcons name="health-and-safety" size={24} color="#4F8F6B" style={s.summaryIcon} />
          <Text style={s.summaryValue}>{healthScore}</Text>
          <Text style={s.summaryLabel}>健康スコア</Text>
        </View>
        <View style={s.summaryCard}>
          <MaterialIcons name="business-center" size={24} color="#7C6A4A" style={s.summaryIcon} />
          <Text style={s.summaryValue}>{jobSearchScore}</Text>
          <Text style={s.summaryLabel}>就活スコア</Text>
        </View>
      </View>

      {/* Window switcher */}
      <View style={s.tabRow}>
        {([7, 30] as const).map(n => (
          <TouchableOpacity
            key={n}
            style={[s.tab, windowDays === n && s.tabActive]}
            onPress={() => setWindowDays(n)}
          >
            <Text style={[s.tabText, windowDays === n && s.tabTextActive]}>
              {n}日間
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mood line chart */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderTitle}>気分の推移</Text>
        <Text style={s.sectionMetric}>
          平均 {avgMoodInWindow !== null ? avgMoodInWindow.toFixed(1) : '--'}
        </Text>
      </View>
      <View style={s.card}>
        <LineChart
          data={moodPoints}
          minY={1}
          maxY={5}
          color={C.primary}
          formatY={v => String(Math.round(v))}
          gridLines={4}
        />
      </View>

      {/* Sleep line chart */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderTitle}>睡眠時間(時間)</Text>
        <Text style={s.sectionMetric}>
          平均 {avgSleepInWindow !== null ? `${avgSleepInWindow.toFixed(1)}h` : '--'}
        </Text>
      </View>
      <View style={s.card}>
        <LineChart
          data={sleepPoints}
          minY={0}
          maxY={12}
          color="#6A8EB3"
          formatY={v => String(Math.round(v))}
          gridLines={4}
        />
      </View>

      {/* Symptoms */}
      <Text style={s.sectionTitle}>症状の頻度({windowDays}日間)</Text>
      <View style={s.card}>
        {symptomFrequencies.length === 0 ? (
          <Text style={s.emptyText}>症状の記録はありません</Text>
        ) : (
          <HorizontalBarChart
            data={symptomFrequencies}
            color="#C77D7D"
            maxValue={windowDays}
          />
        )}
      </View>

      {/* Appetite stacked bar */}
      <Text style={s.sectionTitle}>食欲の分布(30日間)</Text>
      <View style={s.card}>
        <StackedBar data={appetiteStack} />
      </View>

      {/* Exercise */}
      {stats.hasExerciseData && (
        <>
          <Text style={s.sectionTitle}>運動量(平均)</Text>
          <View style={s.card}>
            <View style={s.exerciseRow}>
              <View style={s.exerciseItem}>
                <MaterialIcons name="directions-walk" size={22} color={C.primary} style={s.exerciseIcon} />
                <Text style={s.exerciseValue}>
                  {stats.avgSteps !== null ? Math.round(stats.avgSteps).toLocaleString() : '--'}
                </Text>
                <Text style={s.exerciseUnit}>歩 / 日</Text>
              </View>
              <View style={s.exerciseDivider} />
              <View style={s.exerciseItem}>
                <MaterialIcons name="local-fire-department" size={22} color="#B8683B" style={s.exerciseIcon} />
                <Text style={s.exerciseValue}>
                  {stats.avgActiveCalories !== null ? Math.round(stats.avgActiveCalories).toLocaleString() : '--'}
                </Text>
                <Text style={s.exerciseUnit}>kcal / 日</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Alcohol */}
      <Text style={s.sectionTitle}>飲酒</Text>
      <View style={s.card}>
        <View style={s.alcoholRow}>
          <View style={s.alcoholBlock}>
            <Text style={s.alcoholValue}>{alcoholInWindow}</Text>
            <Text style={s.alcoholLabel}>{windowDays}日間で</Text>
          </View>
          <Text style={s.alcoholDivider}>/</Text>
          <View style={s.alcoholBlock}>
            <Text style={s.alcoholValue}>{stats.totalAlcoholDays}</Text>
            <Text style={s.alcoholLabel}>30日間で</Text>
          </View>
        </View>
      </View>

      <View style={s.bottomPad} />
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
  title: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.selected,
  },
  editBtnText: { fontSize: 12, color: C.primary, fontWeight: 'bold' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 10,
  },
  streakCard: { backgroundColor: '#FFF6EC', borderColor: '#E8C9A0' },
  summaryIcon: { marginBottom: 2 },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: C.primary, marginTop: 2 },
  summaryLabel: { fontSize: 10, color: C.sub, marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontSize: 12, color: C.sub },
  tabTextActive: { color: '#FFF', fontWeight: 'bold' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: C.sub,
    marginBottom: 5,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 5,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: C.sub,
  },
  sectionMetric: {
    fontSize: 12,
    fontWeight: 'bold',
    color: C.primary,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  emptyText: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    paddingVertical: 10,
  },

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
  exerciseUnit: { fontSize: 11, color: C.muted },

  alcoholRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  alcoholBlock: { alignItems: 'center' },
  alcoholValue: { fontSize: 22, fontWeight: 'bold', color: C.primary },
  alcoholLabel: { fontSize: 10, color: C.muted, marginTop: 2 },
  alcoholDivider: { fontSize: 20, color: C.muted },

  bottomPad: { height: 24 },
});
