import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { HealthRecord } from '../services/statsService';
import {
  calculateJobSearchProgress,
  JOB_COMPANIES_STORAGE_KEY,
  JobSearchProgress,
} from '../services/jobSearchProgress';
import {
  buildSupportAdvice,
  collectUpcomingEvents,
  computeConditionSummary,
  conditionLabel,
  ConditionSummary,
  dateToString,
  SupportAdvice,
  SupportCompany,
  SupportEvent,
} from '../services/jobSupport';

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  border: '#D9D0C8',
  card: '#FFFFFF',
  text: '#333333',
  sub: '#555555',
  muted: '#A8BDD4',
  success: '#27AE60',
  danger: '#C0392B',
  warning: '#F59E0B',
};

const TONE_STYLE = {
  warning: { border: '#F59E0B', bg: '#FEF7EA' },
  info: { border: '#304E78', bg: '#EFF3F9' },
  good: { border: '#27AE60', bg: '#EEF8F1' },
} as const;

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadCompanies(uid: string, isDemo: boolean): Promise<SupportCompany[]> {
  if (isDemo) {
    const raw = await AsyncStorage.getItem(JOB_COMPANIES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }
  const snap = await getDocs(collection(db, 'users', uid, 'job_companies'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as SupportCompany) }));
}

async function loadRecentHealthRecords(uid: string, days = 14): Promise<HealthRecord[]> {
  const q = query(
    collection(db, 'users', uid, 'healthRecords'),
    orderBy('date', 'desc'),
    limit(days),
  );
  const snap = await getDocs(q);
  const records: HealthRecord[] = [];
  snap.forEach(d => records.push(d.data() as HealthRecord));
  return records.reverse(); // oldest → newest
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function JobSupportScreen() {
  const { uid, isDemo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [condition, setCondition] = useState<ConditionSummary | null>(null);
  const [events, setEvents] = useState<SupportEvent[]>([]);
  const [advice, setAdvice] = useState<SupportAdvice[]>([]);
  const [progress, setProgress] = useState<JobSearchProgress | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const today = dateToString(new Date());
    const [companies, records] = await Promise.all([
      loadCompanies(uid, isDemo).catch(() => [] as SupportCompany[]),
      loadRecentHealthRecords(uid).catch(() => [] as HealthRecord[]),
    ]);
    const cond = computeConditionSummary(records, today);
    const evts = collectUpcomingEvents(companies, today);
    setCondition(cond);
    setEvents(evts);
    setAdvice(buildSupportAdvice(cond, evts, companies));
    setProgress(calculateJobSearchProgress(companies));
  }, [uid, isDemo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
    >
      <View style={s.header}>
        <Text style={s.title}>就活サポート</Text>
        <Text style={s.subtitle}>体調と就活予定から、今日のおすすめをお届けします</Text>
      </View>

      {/* 今日のコンディション */}
      <Text style={s.sectionTitle}>今日のコンディション</Text>
      <View style={s.card}>
        {condition?.stamina === null || condition === null ? (
          <Text style={s.emptyText}>
            体調の記録がまだありません。{'\n'}ホーム画面から今日の記録をつけましょう。
          </Text>
        ) : (
          <>
            {!condition.recordedToday && (
              <Text style={s.staleNote}>※ 最新の記録（今日の分は未記録）から算出しています</Text>
            )}
            <Gauge label="身体スタミナ" value={condition.stamina} />
            <Gauge label="メンタル" value={condition.mental ?? 0} />
            <View style={s.condMetaRow}>
              {condition.avgSleepHours !== null && (
                <Text style={s.condMeta}>直近平均睡眠 {condition.avgSleepHours.toFixed(1)}h</Text>
              )}
              {condition.streak > 0 && (
                <Text style={s.condMeta}>記録 {condition.streak}日連続 🔥</Text>
              )}
            </View>
          </>
        )}
      </View>

      {/* アドバイス */}
      <Text style={s.sectionTitle}>あなたへのアドバイス</Text>
      {advice.length === 0 ? (
        <View style={s.card}>
          <Text style={s.emptyText}>今日のアドバイスはありません。</Text>
        </View>
      ) : (
        advice.map(a => {
          const tone = TONE_STYLE[a.tone];
          return (
            <View key={a.id} style={[s.adviceCard, { borderLeftColor: tone.border, backgroundColor: tone.bg }]}>
              <Text style={s.adviceIcon}>{a.icon}</Text>
              <View style={s.adviceBody}>
                <Text style={s.adviceTitle}>{a.title}</Text>
                <Text style={s.adviceMessage}>{a.message}</Text>
              </View>
            </View>
          );
        })
      )}

      {/* 直近の予定 */}
      <Text style={s.sectionTitle}>直近の予定（2週間）</Text>
      {events.length === 0 ? (
        <View style={s.card}>
          <Text style={s.emptyText}>期限付きのタスクはありません。</Text>
        </View>
      ) : (
        <View style={s.card}>
          {events.map((e, i) => (
            <View key={e.id} style={[s.eventRow, i === events.length - 1 && s.eventRowLast]}>
              <View style={[s.dayBadge, e.daysLeft < 0 ? s.dayBadgeOverdue : e.daysLeft <= 3 ? s.dayBadgeSoon : null]}>
                <Text style={s.dayBadgeText}>
                  {e.daysLeft < 0 ? '超過' : e.daysLeft === 0 ? '今日' : e.daysLeft === 1 ? '明日' : `${e.daysLeft}日後`}
                </Text>
              </View>
              <View style={s.eventBody}>
                <Text style={s.eventTitle} numberOfLines={1}>
                  {e.isInterview ? '🎤 ' : ''}{e.title}
                </Text>
                <Text style={s.eventMeta} numberOfLines={1}>
                  {e.companyName}　{e.date.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1/$2')}{e.time ? ` ${e.time}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 就活進捗 */}
      {progress && (
        <>
          <Text style={s.sectionTitle}>就活の積み上げ</Text>
          <View style={s.card}>
            <View style={s.progressHeader}>
              <Text style={s.progressScore}>{progress.score}</Text>
              <Text style={s.progressUnit}>/ 100</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressBar, { width: `${progress.score}%` }]} />
            </View>
            <Text style={s.progressLabel}>{progress.label}</Text>
          </View>
        </>
      )}

      <View style={s.bottomSpace} />
    </ScrollView>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const info = conditionLabel(value);
  return (
    <View style={s.gauge}>
      <View style={s.gaugeHeader}>
        <Text style={s.gaugeLabel}>{label}</Text>
        <Text style={[s.gaugeState, { color: info.color }]}>{info.label}</Text>
      </View>
      <View style={s.gaugeTrack}>
        <View style={[s.gaugeBar, { width: `${value}%`, backgroundColor: info.color }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginTop: 8, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#263238' },
  subtitle: { fontSize: 13, color: C.sub, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: C.sub, marginTop: 20, marginBottom: 8 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, paddingVertical: 4 },
  staleNote: { fontSize: 11, color: C.warning, marginBottom: 8 },
  gauge: { marginBottom: 12 },
  gaugeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gaugeLabel: { fontSize: 14, color: C.sub, fontWeight: 'bold' },
  gaugeState: { fontSize: 14, fontWeight: 'bold' },
  gaugeTrack: { height: 10, backgroundColor: '#EEE', borderRadius: 5, overflow: 'hidden' },
  gaugeBar: { height: '100%', borderRadius: 5 },
  condMetaRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  condMeta: { fontSize: 12, color: C.sub },
  adviceCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  adviceIcon: { fontSize: 20, marginTop: 1 },
  adviceBody: { flex: 1 },
  adviceTitle: { fontSize: 14, fontWeight: 'bold', color: C.text, marginBottom: 4 },
  adviceMessage: { fontSize: 13, color: C.sub, lineHeight: 19 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  eventRowLast: { borderBottomWidth: 0 },
  dayBadge: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  dayBadgeSoon: { backgroundColor: C.warning },
  dayBadgeOverdue: { backgroundColor: C.danger },
  dayBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 14, color: C.text, fontWeight: '500' },
  eventMeta: { fontSize: 12, color: C.sub, marginTop: 2 },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  progressScore: { fontSize: 32, fontWeight: 'bold', color: C.primary },
  progressUnit: { fontSize: 14, color: C.muted, marginBottom: 5, marginLeft: 4 },
  progressTrack: { height: 10, backgroundColor: '#EEE', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 5, backgroundColor: C.primary },
  progressLabel: { fontSize: 13, color: C.sub },
  bottomSpace: { height: 40 },
});
