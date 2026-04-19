import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LineChart, { LinePoint } from '../components/charts/LineChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import StackedBar, { StackSegment } from '../components/charts/StackedBar';
import { AppetiteValue, fetchHealthStats, HealthStats } from '../services/statsService';

interface Props {
  uid: string;
  onEdit?: () => void;      // "今日の記録を編集"
}

const APPETITE_META: Record<AppetiteValue, { label: string; emoji: string; color: string }> = {
  nothing:  { label: '食べれない', emoji: '🚫', color: '#C77D7D' },
  water:    { label: '水',         emoji: '💧', color: '#7FA8D0' },
  noodles:  { label: '麺類',       emoji: '🍜', color: '#E0B877' },
  set_meal: { label: '定食',       emoji: '🍱', color: '#6EA56E' },
  steak:    { label: 'ステーキ',   emoji: '🥩', color: '#8E5A3C' },
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
    emoji: APPETITE_META[k].emoji,
    color: APPETITE_META[k].color,
    value: stats.appetiteCounts[k],
  }));

  const alcoholInWindow = windowed.filter(w => w.record?.alcohol === true).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>健康統計</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={s.editBtn}>
            <Text style={s.editBtnText}>記録を編集</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, s.streakCard]}>
          <Text style={s.summaryIcon}>🔥</Text>
          <Text style={s.summaryValue}>{stats.streak}</Text>
          <Text style={s.summaryLabel}>連続記録日</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryIcon}>😊</Text>
          <Text style={s.summaryValue}>
            {stats.avgMood !== null ? stats.avgMood.toFixed(1) : '--'}
          </Text>
          <Text style={s.summaryLabel}>平均気分(7日)</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryIcon}>😴</Text>
          <Text style={s.summaryValue}>
            {stats.avgSleepHours !== null ? stats.avgSleepHours.toFixed(1) : '--'}
          </Text>
          <Text style={s.summaryLabel}>平均睡眠(h)</Text>
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
      <Text style={s.sectionTitle}>気分の推移</Text>
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
      <Text style={s.sectionTitle}>睡眠時間(時間)</Text>
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
      <Text style={s.sectionTitle}>症状の頻度(30日間)</Text>
      <View style={s.card}>
        {stats.symptomCounts.length === 0 ? (
          <Text style={s.emptyText}>症状の記録はありません</Text>
        ) : (
          <HorizontalBarChart
            data={stats.symptomCounts.map(s2 => ({ label: s2.label, value: s2.count }))}
            color="#C77D7D"
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
                <Text style={s.exerciseIcon}>👟</Text>
                <Text style={s.exerciseValue}>
                  {stats.avgSteps !== null ? Math.round(stats.avgSteps).toLocaleString() : '--'}
                </Text>
                <Text style={s.exerciseUnit}>歩 / 日</Text>
              </View>
              <View style={s.exerciseDivider} />
              <View style={s.exerciseItem}>
                <Text style={s.exerciseIcon}>🔥</Text>
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
  summaryIcon: { fontSize: 22 },
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
  exerciseIcon: { fontSize: 20, marginBottom: 2 },
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
