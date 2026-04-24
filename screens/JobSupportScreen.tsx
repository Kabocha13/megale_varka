import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import ShredderInput from './ShredderInput';

// 健康画面で使われている共通カラーパレット（C）を抽出
const C = {
  primary: '#304E78', // ← タイトルの正解の色！
  bg: '#F2EBE4',      // ← 背景色
  text: '#333333',
  sub: '#555555',     // ← サブテキストの正解の色
  successText: '#2E7D32',
  successBg: '#E8F5E9',
  successBorder: '#C8E6C9',
};

export default function JobSupportScreen() {
  const { email } = useAuth();
  const [alreadySaved, setAlreadySaved] = useState(false);

  const handleExpEarned = (amount: number) => {
    console.log(`${amount} EXP 獲得！`);
    setAlreadySaved(true);
  };

  return (
    <View style={s.container}>
      {/* Header部分（健康画面の構成をベースに配置） */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>就活サポート</Text>
          <Text style={s.subText}>発散とおまけ</Text>
          
          {alreadySaved && (
            <View style={s.savedBadge}>
              <Text style={s.savedBadgeIcon}>✓</Text>
              <Text style={s.savedBadgeText}>記録済み</Text>
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
      {/* コンテンツ部分（シュレッダー機能のみ） */}
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: C.primary, // 健康画面と完全に一致
    marginBottom: 4 
  },
  subText: { 
    fontSize: 14, 
    color: C.sub,     // 健康画面のグレーと完全に一致
    marginBottom: 8 
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.successBorder,
    alignSelf: 'flex-start',
  },
  savedBadgeIcon: {
    fontSize: 12,
    color: C.successText,
    marginRight: 4,
    fontWeight: 'bold',
  },
  savedBadgeText: {
    fontSize: 11,
    color: C.successText,
    fontWeight: 'bold',
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 20 
  },
});