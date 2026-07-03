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
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import LineChart, { LinePoint } from '../components/charts/LineChart';
import { HealthRecord } from '../services/statsService';
import {
  calculateJobSearchProgress,
  JOB_COMPANIES_STORAGE_KEY,
  JobSearchProgress,
} from '../services/jobSearchProgress';
import {
  buildInterviewRetrospective,
  buildSupportAdvice,
  buildWeeklyPlan,
  collectUpcomingEvents,
  computeConditionSummary,
  conditionLabel,
  conditionScoreOf,
  ConditionSummary,
  dateToString,
  InterviewRetroItem,
  SupportAdvice,
  SupportCompany,
  SupportEvent,
  WeeklyPlan,
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

const WEEKDAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'];

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

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
  const [weekly, setWeekly] = useState<WeeklyPlan | null>(null);
  const [retro, setRetro] = useState<InterviewRetroItem[]>([]);
  const [chartPoints, setChartPoints] = useState<LinePoint[]>([]);

  const load = useCallback(async () => {
    if (!uid) return;
    const today = dateToString(new Date());
    const [companies, records] = await Promise.all([
      loadCompanies(uid, isDemo).catch(() => [] as SupportCompany[]),
      loadRecentHealthRecords(uid, 30).catch(() => [] as HealthRecord[]),
    ]);
    // コンディションは直近7件、傾向分析・振り返りは30日分を使う
    const cond = computeConditionSummary(records.slice(-7), today);
    const evts = collectUpcomingEvents(companies, today);
    setCondition(cond);
    setEvents(evts);
    setAdvice(buildSupportAdvice(cond, evts, companies));
    setProgress(calculateJobSearchProgress(companies));
    setWeekly(buildWeeklyPlan(records, evts, today));
    setRetro(buildInterviewRetrospective(companies, records, today));
    setChartPoints(
      records.slice(-14).map(r => {
        const [, m, d] = r.date.split('-').map(Number);
        return { label: `${m}/${d}`, value: conditionScoreOf(r) };
      }),
    );
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
                <View style={s.condMetaRowItem}>
                  <MaterialIcons name="local-fire-department" size={13} color={C.warning} />
                  <Text style={s.condMeta}>記録 {condition.streak}日連続</Text>
                </View>
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
              <MaterialIcons name={a.icon} size={20} color={tone.border} style={s.adviceIcon} />
              <View style={s.adviceBody}>
                <Text style={s.adviceTitle}>{a.title}</Text>
                <Text style={s.adviceMessage}>{a.message}</Text>
              </View>
            </View>
          );
        })
      )}

      {/* 週間プランニング */}
      {weekly && (
        <>
          <Text style={s.sectionTitle}>今週のプランニング</Text>
          <View style={s.card}>
            <View style={s.weekRow}>
              {weekly.days.map(day => {
                const [, , dd] = day.date.split('-').map(Number);
                const kindStyle =
                  day.kind === 'busy' ? s.dayChipBusy
                  : day.kind === 'work' ? s.dayChipWork
                  : day.kind === 'rest' ? s.dayChipRest
                  : null;
                return (
                  <View key={day.date} style={[s.dayChip, kindStyle]}>
                    <Text style={s.dayChipWeekday}>{WEEKDAY_CHARS[day.weekday]}</Text>
                    <Text style={s.dayChipDate}>{dd}</Text>
                    {day.hasInterview ? (
                      <MaterialIcons name="mic" size={12} color={C.warning} />
                    ) : (
                      <Text style={s.dayChipMark}>
                        {day.eventCount > 0 ? `${day.eventCount}件` : day.kind === 'work' ? '◎' : day.kind === 'rest' ? '休' : '　'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={s.weekLegend}>
              <View style={s.weekLegendRow}>
                <View style={[s.weekLegendSwatch, { backgroundColor: C.warning }]} />
                <Text style={s.weekLegendItem}>予定あり</Text>
              </View>
              <View style={s.weekLegendRow}>
                <View style={[s.weekLegendSwatch, { backgroundColor: C.success }]} />
                <Text style={s.weekLegendItem}>作業おすすめ</Text>
              </View>
              <View style={s.weekLegendRow}>
                <View style={[s.weekLegendSwatch, { backgroundColor: C.muted }]} />
                <Text style={s.weekLegendItem}>休息推奨</Text>
              </View>
            </View>
            {weekly.recommendedDate ? (
              <Text style={s.weekNote}>
                {formatShortDate(weekly.recommendedDate)}（{WEEKDAY_CHARS[dayOfWeek(weekly.recommendedDate)]}）は過去の体調傾向が良い日です。ESの作成や企業研究を進めるのにおすすめです。
              </Text>
            ) : weekly.days.every(d => d.tendency === null) ? (
              <Text style={s.weekNote}>
                体調記録が増えると、曜日ごとのコンディション傾向から作業に向く日を提案します。
              </Text>
            ) : null}
          </View>
        </>
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
                <View style={s.eventTitleRow}>
                  {e.isInterview && (
                    <MaterialIcons name="mic" size={14} color={C.primary} style={s.eventTitleIcon} />
                  )}
                  <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                </View>
                <Text style={s.eventMeta} numberOfLines={1}>
                  {e.companyName}　{e.date.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1/$2')}{e.time ? ` ${e.time}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 体調と選考のふりかえり */}
      {(chartPoints.length >= 2 || retro.length > 0) && (
        <>
          <Text style={s.sectionTitle}>体調と選考のふりかえり</Text>
          <View style={s.card}>
            {chartPoints.length >= 2 && (
              <>
                <Text style={s.chartCaption}>総合コンディションの推移（直近の記録）</Text>
                <LineChart data={chartPoints} minY={0} maxY={100} height={150} color={C.primary} />
              </>
            )}
            {retro.length > 0 && (
              <View style={chartPoints.length >= 2 ? s.retroList : null}>
                {retro.map((item, i) => {
                  const info = item.conditionScore !== null ? conditionLabel(item.conditionScore) : null;
                  return (
                    <View key={`${item.companyName}_${item.date}`} style={[s.retroRow, i === retro.length - 1 && s.retroRowLast]}>
                      <Text style={s.retroDate}>{formatShortDate(item.date)}</Text>
                      <View style={s.retroBody}>
                        <Text style={s.retroTitle} numberOfLines={1}>
                          {item.companyName}：{item.title}
                        </Text>
                        <Text style={s.retroStatus} numberOfLines={1}>
                          {item.selectionStatus || '選考状況未設定'}
                        </Text>
                      </View>
                      {info ? (
                        <View style={[s.retroScoreBadge, { backgroundColor: info.color }]}>
                          <Text style={s.retroScoreText}>{item.conditionScore}</Text>
                        </View>
                      ) : (
                        <View style={[s.retroScoreBadge, s.retroScoreBadgeEmpty]}>
                          <Text style={s.retroScoreTextEmpty}>—</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {retro.length > 0 && (
              <Text style={s.retroHint}>
                面接当日の体調スコアと選考状況を並べています。自分のベストコンディションのパターンを見つけましょう。
              </Text>
            )}
          </View>
        </>
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
  condMetaRowItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
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
  adviceIcon: { marginTop: 1 },
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
  eventTitleRow: { flexDirection: 'row', alignItems: 'center' },
  eventTitleIcon: { marginRight: 4 },
  eventTitle: { flexShrink: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  eventMeta: { fontSize: 12, color: C.sub, marginTop: 2 },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  progressScore: { fontSize: 32, fontWeight: 'bold', color: C.primary },
  progressUnit: { fontSize: 14, color: C.muted, marginBottom: 5, marginLeft: 4 },
  progressTrack: { height: 10, backgroundColor: '#EEE', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 5, backgroundColor: C.primary },
  progressLabel: { fontSize: 13, color: C.sub },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  dayChipBusy: { backgroundColor: '#FEF7EA', borderColor: C.warning },
  dayChipWork: { backgroundColor: '#EEF8F1', borderColor: C.success },
  dayChipRest: { backgroundColor: '#F1F1F1', borderColor: C.muted },
  dayChipWeekday: { fontSize: 11, color: C.sub },
  dayChipDate: { fontSize: 15, fontWeight: 'bold', color: C.text, marginVertical: 2 },
  dayChipMark: { fontSize: 10, color: C.sub },
  weekLegend: { flexDirection: 'row', gap: 12, marginTop: 10 },
  weekLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekLegendSwatch: { width: 10, height: 10, borderRadius: 2 },
  weekLegendItem: { fontSize: 11, color: C.sub },
  weekNote: { fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 18 },
  chartCaption: { fontSize: 12, color: C.sub, marginBottom: 8 },
  retroList: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  retroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  retroRowLast: { borderBottomWidth: 0 },
  retroDate: { fontSize: 12, color: C.sub, width: 38 },
  retroBody: { flex: 1 },
  retroTitle: { fontSize: 13, color: C.text, fontWeight: '500' },
  retroStatus: { fontSize: 12, color: C.sub, marginTop: 2 },
  retroScoreBadge: {
    borderRadius: 12,
    minWidth: 36,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  retroScoreBadgeEmpty: { backgroundColor: '#EEE' },
  retroScoreText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  retroScoreTextEmpty: { color: C.muted, fontSize: 13, fontWeight: 'bold' },
  retroHint: { fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 16 },
  bottomSpace: { height: 40 },
});
