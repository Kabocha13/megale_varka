import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import OmikujiModal from './omikuji'; // おみくじファイルをインポート

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  sub: '#555555',
  successText: '#2E7D32',
  successBg: '#E8F5E9',
  successBorder: '#C8E6C9',
};

// --- 簡易データ保存用変数（アプリ起動中のみ記憶） ---
// 画面を移動しても「完了した」という事実を覚えておくための変数
let globalMentalRecovered = false;

export default function OmikujiScreen() {
  // 初期値を false ではなく、グローバル変数の値にする
  const [modalVisible, setModalVisible] = useState(false);
  const [mentalRecovered, setMentalRecovered] = useState(globalMentalRecovered);

  // 画面が開かれるたびに、グローバル変数の状態をチェックして表示を更新
  useEffect(() => {
    setMentalRecovered(globalMentalRecovered);
  }, []);

  const handleMentalRecovered = (amount: number) => {
    console.log(`メンタルが ${amount} 回復！`);
    
    // 画面の表示を更新するのと同時に、裏側の記憶も「完了」にする
    globalMentalRecovered = true;
    setMentalRecovered(true);
  };

  return (
    <View style={s.container}>
      {/* Header：デザインは他画面と統一 */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>就活サポート</Text>
          
          {mentalRecovered && (
            <View style={s.savedBadge}>
              <Text style={s.savedBadgeIcon}>✓</Text>
              <Text style={s.savedBadgeText}>おみくじ完了</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardText}>
            今日の分のおみくじを引いて運気を見てみよう。
          </Text>
          
          {/* おみくじ完了後はボタンの文字を変えるなどすると親切です */}
          <TouchableOpacity 
            style={s.drawButton} 
            onPress={() => setModalVisible(true)}
          >
            <Text style={s.drawButtonText}>
              {mentalRecovered ? "引いたおみくじを見る" : "おみくじを開く"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* インポートしたおみくじモーダルを配置 */}
      <OmikujiModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        onMentalRecovered={handleMentalRecovered}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: C.primary, marginBottom: 4 },
  subText: { fontSize: 14, color: C.sub, marginBottom: 8 },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.successBorder,
    marginTop: 4,
  },
  savedBadgeIcon: { fontSize: 12, color: C.successText, marginRight: 4, fontWeight: 'bold' },
  savedBadgeText: { fontSize: 11, color: C.successText, fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C8',
  },
  cardText: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  drawButton: {
    backgroundColor: C.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  drawButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});