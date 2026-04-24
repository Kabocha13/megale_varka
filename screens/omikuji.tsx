import React, { useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type OmikujiResult = {
  title: string;
  message: string;
};

type OmikujiModalProps = {
  visible: boolean;
  onClose: () => void;
  onMentalRecovered?: (amount: number) => void;
  recoveryAmount?: number;
};

const FORTUNES = [
  '大吉', 
  '中吉','中吉',
  '小吉','小吉','小吉',
  '吉','吉','吉',
  '末吉', '末吉',
  '凶'
];

const QUOTES = [
  '「成功は、情熱を失わずに失敗を重ねる能力のことだ」（ウィンストン・チャーチル）',
  '「凧が一番高く上がるのは、風に向かっている時である。風に流されている時ではない。」（チャーチル）',
  '「夢を掴むことというのは、一歩ずつ近づくことではない。一歩ずつ、夢に相応しい自分に変わることだ。」（イチロー）',
  '「世の中に失敗というものはない。チャレンジしているうちは失敗ではない。」（本田宗一郎）',
  '「最も困難なのは、行動に移そうと決心することだ。あとはただ執念の問題だ。」（アメリア・イアハート）',
  '「あなたの進みがどんなに遅くても、止まっていない限り、それは前進である。」（孔子）',
  '「明日死ぬかのように生きよ。永遠に生きるかのように学べ」（マハトマ・ガンジー）',
  '「チャンスは、準備された心にのみ降り立つ。」（パスツール）',
  '「自分自身を信じなさい。そうすれば、どう生きるべきかが見えてくる。」（ゲーテ）',
  '「始めるために偉大である必要はないが、偉大になるためには始める必要がある。」（ジグ・ジグラー）',
  '「人生に無駄なことなど、ひとつもない。」（スティーブ・ジョブズ）',
  '「一歩踏み出せるなら、もう一歩も踏み出せる。」（トッド・スキナー）',
  '「待っている人に良いことが来るかもしれないが、それは動いている人が残したものだけだ。」（リンカーン）',
  '「楽観主義者は、困難の中にチャンスを見出す。悲観主義者は、チャンスの中に困難を見出す。」（チャーチル）',
  '「他人と比較して自分を恥じる必要はない。昨日の自分と比較して、今日の自分がどうかを考えなさい。」（バカボンパパ）',
  '「何も咲かない寒い日は、下へ下へと根を伸ばせ。」（高橋尚子）',
  '「行動を伴わない想像力は、何の意味も持たない」（チャーリー・チャップリン）',
  '「準備を怠る者は、失敗を準備しているのだ」（ベンジャミン・フランクリン）',
  '「最大の名誉は決して倒れないことではない。倒れるたびに起き上がることである」（孔子）',
  '「冬来たりなば春遠からじ。」（シェリー）',
  '「失敗したことのない人間は、新しいことに挑戦したことのない人間だ。」（アインシュタイン）',
  '「あなたの時間は限られている。だから、誰か他の人の人生を生きることで時間を無駄にしてはいけない。」（ジョブズ）',
  '「置かれた場所で咲きなさい。」（渡辺和子）',
  '「失敗の多くは、成功するまで諦めないという執念がないところに原因がある。」（松下幸之助）'
];

// --- 簡易データ保存用変数（アプリ起動中のみ記憶） ---
// これにより、画面を閉じても「今日引いた結果」を覚えている状態を作れます
let globalDrawnDate: string | null = null;
let globalDrawnResult: OmikujiResult | null = null;

// 今日が何日か取得する関数
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function pickRandomResult(): OmikujiResult {
  const randomFortuneIndex = Math.floor(Math.random() * FORTUNES.length);
  const randomQuoteIndex = Math.floor(Math.random() * QUOTES.length);
  return {
    title: FORTUNES[randomFortuneIndex],
    message: QUOTES[randomQuoteIndex]
  };
}

export default function OmikujiModal({
  visible,
  onClose,
  onMentalRecovered,
  recoveryAmount = 5,
}: OmikujiModalProps) {
  const [currentResult, setCurrentResult] = useState<OmikujiResult | null>(null);
  const [hasDrawnToday, setHasDrawnToday] = useState(false);

  // モーダルが開かれた時に、今日すでに引いているか確認する
  useEffect(() => {
    if (visible) {
      const today = getTodayString();
      if (globalDrawnDate === today && globalDrawnResult) {
        // すでに引いていれば、記憶しておいた結果を表示
        setCurrentResult(globalDrawnResult);
        setHasDrawnToday(true);
      } else {
        // まだ引いていなければ、まっさらな状態にする
        setCurrentResult(null);
        setHasDrawnToday(false);
      }
    }
  }, [visible]);

  function handleDraw(): void {
    const result = pickRandomResult();
    setCurrentResult(result);
    setHasDrawnToday(true);
    
    // 引いた結果と今日の日付を、ファイル外の変数に記録
    globalDrawnDate = getTodayString();
    globalDrawnResult = result;

    onMentalRecovered?.(recoveryAmount);
  }

  function handleClose(): void {
    onClose();
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>就活おみくじ</Text>
          <Text style={styles.subtitle}>運勢と一言で、気持ちを立て直そう。</Text>

          {currentResult ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>{currentResult.title}</Text>
              <Text style={styles.resultMessage}>{currentResult.message}</Text>
            </View>
          ) : (
            <View style={styles.resultPlaceholder}>
              <Text style={styles.resultPlaceholderText}>まだ引いていません</Text>
            </View>
          )}

          {/* まだ引いていない時だけボタンを押せるようにする */}
          {!hasDrawnToday ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleDraw}>
              <Text style={styles.primaryButtonText}>おみくじを引く</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.primaryButton, { backgroundColor: '#a0aec0' }]}>
              <Text style={styles.primaryButtonText}>本日は終了（また明日！）</Text>
            </View>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleClose}>
            <Text style={styles.secondaryButtonText}>閉じる</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#5d5d5d',
    textAlign: 'center',
    marginBottom: 14,
  },
  resultBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dedede',
    backgroundColor: '#f8f8f8',
    padding: 14,
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 14,
    color: '#222222',
    textAlign: 'center',
    lineHeight: 21,
  },
  resultPlaceholder: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cdcdcd',
    padding: 18,
    marginBottom: 14,
  },
  resultPlaceholderText: {
    textAlign: 'center',
    color: '#777777',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#444444',
    fontSize: 14,
    fontWeight: '600',
  },
});