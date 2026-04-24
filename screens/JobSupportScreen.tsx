import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import ShredderInput from './ShredderInput';
import OmikujiModal from './omikuji';

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
    console.log(`${amount} EXP 獲得！`);
    setAlreadySaved(true);
  };

  const handleMentalRecovered = (amount: number) => {
    console.log(`メンタルが ${amount} 回復！`);
    globalMentalRecovered = true;
    setMentalRecovered(true);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>就活サポート</Text>
          <Text style={s.subText}>発散とルーティン</Text>
          
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

      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardText}>
            今日の分のおみくじを引いて運気を見てみよう。
          </Text>
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

      <View style={s.content}>
        <ShredderInput 
          onExpEarned={handleExpEarned}
          placeholder="お祈りメールの悔しさや不安をここに書いて燃やしましょう"
          buttonLabel="シュレッダーでさよならする"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: C.primary, marginBottom: 4 },
  subText: { fontSize: 14, color: C.sub, marginBottom: 8 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: C.successBorder, alignSelf: 'flex-start' },
  savedBadgeIcon: { fontSize: 12, color: C.successText, marginRight: 4, fontWeight: 'bold' },
  savedBadgeText: { fontSize: 11, color: C.successText, fontWeight: 'bold' },
  content: { paddingHorizontal: 20, marginBottom: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#D9D0C8' },
  cardText: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  drawButton: { backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 },
  drawButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});