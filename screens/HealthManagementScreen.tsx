import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const HealthManagementScreen = () => {
  const { uid } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [physicalChecks, setPhysicalChecks] = useState([false, false, false, false]);
  const [mentalChecks, setMentalChecks] = useState([false, false, false, false]);
  
  // 各パラメータのベーススコア
  const [staminaBaseScore, setStaminaBaseScore] = useState(30); 
  const [sleepBonus, setSleepBonus] = useState(0); // 睡眠時間による加減算
  const [moodBaseScore, setMoodBaseScore] = useState(30);
  const [symptomPenalty, setSymptomPenalty] = useState(0); 
  const [dailyAnswerScore, setDailyAnswerScore] = useState(0);

  useEffect(() => {
    async function fetchTodayHealthData() {
      if (!uid) return;
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      try {
        const snap = await getDoc(doc(db, 'users', uid, 'healthRecords', todayStr));
        if (snap.exists()) {
          const data = snap.data();

          // --- スタミナ：食欲レベルによるベース変動 ---
          if (data.appetite) {
            const appetiteScores: Record<string, number> = {
              steak: 40, set_meal: 40, noodles: 30, water: 15, nothing: 5
            };
            setStaminaBaseScore(appetiteScores[data.appetite] || 30);
          }

          // --- スタミナ：睡眠時間による加減算 ---
          if (data.sleep !== undefined) {
            const sleepHours = data.sleep / 60; // 分を時間に変換
            if (sleepHours >= 8) {
              setSleepBonus(20);
            } else if (sleepHours >= 6) {
              setSleepBonus(10);
            } else if (sleepHours >= 5) {
              setSleepBonus(-10);
            } else if (sleepHours <= 4) {
              setSleepBonus(-20);
            } else {
              setSleepBonus(0);
            }
          }

          // --- メンタル変動 ---
          if (data.mood) setMoodBaseScore(data.mood * 10);
          if (data.symptoms && Array.isArray(data.symptoms)) setSymptomPenalty(data.symptoms.length * 5);
          if (data.dailyAnswer) {
            const answerScores: Record<string, number> = {
              none: 10, little: 5, some: -5, always: -10
            };
            setDailyAnswerScore(answerScores[data.dailyAnswer] || 0);
          }
        }
      } catch (error) {
        console.log("Data fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTodayHealthData();
  }, [uid]);

  // 各パラメータ算出
  // スタミナ = (食欲ベース + 睡眠ボーナス) + チェック加算
  const staminaResult = (staminaBaseScore + sleepBonus) + (physicalChecks.filter(c => c).length * 15);
  const stamina = Math.max(0, Math.min(100, staminaResult));

  const mentalResult = (moodBaseScore - symptomPenalty + dailyAnswerScore) + (mentalChecks.filter(c => c).length * 12.5);
  const mental = Math.max(0, Math.min(100, mentalResult));

  // 判定ロジック
  const getConditionInfo = (score: number) => {
    if (score >= 71) return { label: '絶好調', color: '#E67E22' };
    if (score >= 51) return { label: '好調', color: '#27AE60' };
    if (score >= 21) return { label: '正常', color: '#304E78' };
    return { label: '不調', color: '#C0392B' };
  };

  const staminaInfo = getConditionInfo(stamina);
  const mentalInfo = getConditionInfo(mental);

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#304E78" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>健康管理ステータス</Text>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.statusSection}>
          <StatusGauge label="身体スタミナ" value={stamina} color={staminaInfo.color} />
          <View style={styles.conditionRow}>
            <Text style={styles.conditionLabel}>スタミナ状態: </Text>
            <Text style={[styles.conditionValue, { color: staminaInfo.color }]}>{staminaInfo.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statusSection}>
          <StatusGauge label="メンタル回復" value={mental} color={mentalInfo.color} />
          <View style={styles.conditionRow}>
            <Text style={styles.conditionLabel}>メンタル状態: </Text>
            <Text style={[styles.conditionValue, { color: mentalInfo.color }]}>{mentalInfo.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>身体の休養休息</Text>
      <View style={styles.listCard}>
        {['短時間の仮眠', 'ストレッチ', '入浴', 'こまめな水分補給'].map((label, i) => (
          <CheckItem key={i} label={label} checked={physicalChecks[i]} onPress={() => {
            const n = [...physicalChecks]; n[i] = !n[i]; setPhysicalChecks(n);
          }} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>心の休養休息</Text>
      <View style={styles.listCard}>
        {['好きな飲み物を飲む', '音楽を聴く', '外の空気を吸う', '3分間の瞑想'].map((label, i) => (
          <CheckItem key={i} label={label} checked={mentalChecks[i]} onPress={() => {
            const n = [...mentalChecks]; n[i] = !n[i]; setMentalChecks(n);
          }} />
        ))}
      </View>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const StatusGauge = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.gaugeContainer}>
    <View style={styles.gaugeHeader}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <Text style={styles.gaugeValue}>{Math.round(value)}</Text>
    </View>
    <View style={styles.gaugeTrack}>
      <View style={[styles.gaugeBar, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const CheckItem = ({ label, checked, onPress }: any) => (
  <TouchableOpacity style={styles.checkItem} onPress={onPress}>
    <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
      {checked && <Text style={styles.checkMark}>✓</Text>}
    </View>
    <Text style={[styles.checkLabel, checked && styles.checkLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EBE4' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#304E78' },
  chartCard: { backgroundColor: '#FFF', margin: 16, padding: 20, borderRadius: 20, elevation: 4 },
  statusSection: { paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  gaugeContainer: { marginBottom: 10 },
  gaugeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gaugeLabel: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  gaugeValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  gaugeTrack: { height: 10, backgroundColor: '#EEE', borderRadius: 5, overflow: 'hidden' },
  gaugeBar: { height: '100%', borderRadius: 5 },
  conditionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  conditionLabel: { fontSize: 14, color: '#888' },
  conditionValue: { fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 20, marginTop: 15, color: '#304E78' },
  listCard: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 8, borderRadius: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#A8BDD4', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  checkBoxActive: { backgroundColor: '#304E78', borderColor: '#304E78' },
  checkMark: { color: '#FFF', fontWeight: 'bold' },
  checkLabel: { fontSize: 15, color: '#333' },
  checkLabelActive: { color: '#AAA', textDecorationLine: 'line-through' },
});

export default HealthManagementScreen;