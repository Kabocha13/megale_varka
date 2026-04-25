import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import ShredderInput from './ShredderInput';
import OmikujiModal from './omikuji';
import HealthManagementScreen from './HealthManagementScreen';

let globalMentalRecovered = false;

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  text: '#333333',
  sub: '#555555',
  successText: '#2E7D32',
  successBg: '#E8F5E9',
  successBorder: '#C8E6C9',
};

export default function JobSupportScreen() {
  const { email } = useAuth();
  
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mentalRecovered, setMentalRecovered] = useState(globalMentalRecovered);

  useEffect(() => {
    setMentalRecovered(globalMentalRecovered);
  }, []);

  const handleExpEarned = (amount: number) => {
    setAlreadySaved(true);
  };

  const handleMentalRecovered = (amount: number) => {
    globalMentalRecovered = true;
    setMentalRecovered(true);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>就活サポート</Text>
          <Text style={s.subText}>コンディションとメンタルケア</Text>
          
          {(alreadySaved || mentalRecovered) && (
            <View style={s.savedBadge}>
              <Text style={s.savedBadgeIcon}>✓</Text>
              <Text style={s.savedBadgeText}>
                {mentalRecovered ? "おみくじ完了" : "記録済み"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 1. パラメータ表示 (HealthManagementScreenの上部グラフ部分) */}
      <View style={s.section}>
        <HealthManagementScreen showOnly="stats" />
      </View>

      {/* 2. おみくじ */}
      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardText}>今日のおみくじで運気を確認</Text>
          <TouchableOpacity style={s.drawButton} onPress={() => setModalVisible(true)}>
            <Text style={s.drawButtonText}>
              {mentalRecovered ? "引いたおみくじを見る" : "おみくじを開く"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <OmikujiModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        onMentalRecovered={handleMentalRecovered}
      />

      {/* 3. 休養のチェックリスト (HealthManagementScreenの下部リスト部分) */}
      <View style={s.section}>
        <HealthManagementScreen showOnly="missions" />
      </View>

      <View style={s.divider} />

      {/* 4. シュレッダー */}
      <View style={s.content}>
        <Text style={s.sectionTitle}>感情の整理</Text>
        <ShredderInput 
          onExpEarned={handleExpEarned}
          placeholder="モヤモヤを書いてシュレッダーにかけましょう"
          buttonLabel="シュレッダーでさよならする"
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 20 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  headerLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: C.primary },
  subText: { fontSize: 14, color: C.sub, marginBottom: 8 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: C.successBorder },
  savedBadgeIcon: { fontSize: 12, color: C.successText, marginRight: 4, fontWeight: 'bold' },
  savedBadgeText: { fontSize: 11, color: C.successText, fontWeight: 'bold' },
  section: { marginBottom: 10 },
  content: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: C.primary, marginBottom: 10, marginLeft: 5 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#D9D0C8' },
  cardText: { fontSize: 15, color: '#333', marginBottom: 15 },
  drawButton: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  drawButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#D9D0C8', marginHorizontal: 20, marginVertical: 10, opacity: 0.5 },
});