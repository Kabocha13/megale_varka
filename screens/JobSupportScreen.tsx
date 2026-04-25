import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../context/AuthContext';
import { CareerFitChatResponse, askCareerFitChat } from '../services/careerFitChat';
import HealthManagementScreen from './HealthManagementScreen';

type SupportView = 'home' | 'career_fit';
type ChatRole = 'assistant' | 'user';

interface ChatStep {
  id: string;
  message: string;
  choices: string[];
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface FeedbackMetric {
  label: string;
  value: number;
}

const C = {
  bg: '#F2EBE4',
  card: '#FFFFFF',
  text: '#263238',
  sub: '#607D8B',
  muted: '#90A4AE',
  primary: '#304E78',
  border: '#E0D6CD',
  accent: '#7A9E7E',
};

const CHAT_STEPS: ChatStep[] = [
  {
    id: 'purpose',
    message: 'まず、このチャット診断の目的をはっきりさせましょう。今いちばん知りたいことはどれですか？',
    choices: ['自分に合う業界を知りたい', '向いている職種を知りたい', 'おすすめの企業を知りたい'],
  },
  {
    id: 'current_state',
    message: 'ありがとう。今の就活状況に近いものを教えてください。ここで質問の深さを調整します。',
    choices: ['まだ自己分析中', '業界・職種を調べ始めた', '応募先を絞り始めた'],
  },
  {
    id: 'interest',
    message: 'どんなテーマに関わる仕事だと、前向きに調べたり考えたりできそうですか？',
    choices: ['人の暮らしや体験を良くする', '仕組みや数字で課題を解く', '新しい商品やサービスを広げる'],
  },
  {
    id: 'work_style',
    message: '仕事の進め方として、しっくりくるものはどれですか？',
    choices: ['人と話しながら進めたい', '考えて整理する時間がほしい', '手を動かして形にしたい'],
  },
  {
    id: 'priority',
    message: '最後に、企業や仕事を選ぶときに特に大事にしたい軸を教えてください。',
    choices: ['安定性や働きやすさ', '成長機会やスピード感', '社会への貢献実感'],
  },
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function buildLocalSummary(answers: Record<string, string>): string {
  const purpose = answers.purpose ?? '知りたいこと';

  if (purpose.includes('業界')) {
    return 'ここまでの回答を見ると、まずは業界候補を広めに出してから、興味テーマと働き方で絞るのが良さそうです。AI連携後は、この回答をもとに相性の良い業界群と、比較するとよい観点を返します。';
  }

  if (purpose.includes('職種')) {
    return 'ここまでの回答を見ると、職種の向き不向きを「人と進める」「考えて整理する」「形にする」のどこで力が出やすいかから見ていくのが良さそうです。AI連携後は、候補職種と理由、避けた方がよさそうな職種傾向まで返します。';
  }

  if (purpose.includes('企業')) {
    return 'ここまでの回答を見ると、おすすめ企業を出す前に、企業規模、職種、重視する価値観をもう少し絞るのが良さそうです。AI連携後は、候補企業の条件と検索キーワード、見るべき企業ページの観点まで返します。';
  }

  return '目的を自由入力してくれたので、その内容を起点に診断を組み立てます。AI連携後は、あなたの目的に合わせて追加質問を変えながら、納得できる方向性まで対話で絞り込みます。';
}

function buildLocalResponse(nextStep: number, answers: Record<string, string>): CareerFitChatResponse {
  const next = CHAT_STEPS[nextStep];
  if (next) {
    return { message: next.message, choices: next.choices, done: false };
  }

  return {
    message: buildLocalSummary(answers),
    choices: ['業界候補を見たい', '職種候補を見たい', '企業選びの軸を見たい'],
    done: true,
  };
}

function normalizeMetrics(metrics: CareerFitChatResponse['metrics']): FeedbackMetric[] {
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics
    .slice(0, 6)
    .map(metric => ({
      label: String(metric.label).slice(0, 8),
      value: clampScore(Number(metric.value) || 0),
    }))
    .filter(metric => metric.label);
}

function clampScore(value: number): number {
  return Math.max(24, Math.min(94, value));
}

function buildFeedbackMetrics(answers: Record<string, string>): FeedbackMetric[] {
  const joinedAnswers = Object.values(answers).join(' ');
  const has = (word: string) => joinedAnswers.includes(word);

  return [
    {
      label: '対話',
      value: clampScore(46 + (has('人') || has('話') ? 30 : 0) + (has('暮らし') || has('体験') ? 12 : 0)),
    },
    {
      label: '分析',
      value: clampScore(44 + (has('仕組み') || has('数字') ? 32 : 0) + (has('整理') ? 18 : 0)),
    },
    {
      label: '創造',
      value: clampScore(42 + (has('新しい') || has('サービス') ? 28 : 0) + (has('形') || has('手を動か') ? 20 : 0)),
    },
    {
      label: '安定',
      value: clampScore(40 + (has('安定') || has('働きやす') ? 36 : 0) + (has('絞り') ? 10 : 0)),
    },
    {
      label: '成長',
      value: clampScore(42 + (has('成長') || has('スピード') ? 36 : 0) + (has('応募') ? 10 : 0)),
    },
    {
      label: '貢献',
      value: clampScore(40 + (has('社会') || has('貢献') ? 38 : 0) + (has('暮らし') ? 12 : 0)),
    },
  ];
}

async function requestPhotoSavePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const androidVersion = Number(Platform.Version);
  if (androidVersion >= 29 && androidVersion < 33) {
    return true;
  }

  const permission = androidVersion >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function CareerFitScreen({ onBack }: { onBack: () => void }) {
  const { isDemo } = useAuth();
  const exportCardRef = useRef<View>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'initial_purpose', role: 'assistant', text: CHAT_STEPS[0].message },
  ]);
  const [choices, setChoices] = useState<string[]>(CHAT_STEPS[0].choices);
  const [done, setDone] = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [aiMetrics, setAiMetrics] = useState<FeedbackMetric[]>([]);
  const current = CHAT_STEPS[step];
  const feedbackMetrics = aiMetrics.length > 0 ? aiMetrics : buildFeedbackMetrics(answers);
  const finalFeedback = [...messages].reverse().find(message => message.role === 'assistant')?.text ?? '';

  const answerCurrentStep = async (answer: string) => {
    const answerKey = current?.id ?? `ai_turn_${step}`;
    const nextAnswers = { ...answers, [answerKey]: answer };
    const nextStep = step + 1;
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: makeId('user'), role: 'user', text: answer },
    ];

    setAnswers(nextAnswers);
    setMessages(nextMessages);
    setOtherMode(false);
    setOtherText('');
    setStep(nextStep);
    setErrorText('');
    setLoadingReply(true);

    try {
      const response = isDemo
        ? buildLocalResponse(nextStep, nextAnswers)
        : await askCareerFitChat(nextMessages.map(message => ({
          role: message.role,
          text: message.text,
        })));

      setMessages([
        ...nextMessages,
        { id: makeId('assistant'), role: 'assistant', text: response.message },
      ]);
      setChoices(response.choices);
      setDone(response.done);
      setAiMetrics(normalizeMetrics(response.metrics));
    } catch (error: unknown) {
      const fallback = buildLocalResponse(nextStep, nextAnswers);
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      const message = error instanceof Error ? error.message : '';
      console.warn('careerFitChat failed:', { code, message });
      setMessages([
        ...nextMessages,
        { id: makeId('assistant'), role: 'assistant', text: fallback.message },
      ]);
      setChoices(fallback.choices);
      setDone(fallback.done);
      setAiMetrics(buildFeedbackMetrics(nextAnswers));
      setErrorText(`AIとの通信に失敗したため、仮の応答で続けています。${code || message ? ` (${code || message})` : ''}`);
    } finally {
      setLoadingReply(false);
    }
  };

  const restart = () => {
    setStep(0);
    setAnswers({});
    setMessages([{ id: 'initial_purpose', role: 'assistant', text: CHAT_STEPS[0].message }]);
    setChoices(CHAT_STEPS[0].choices);
    setDone(false);
    setLoadingReply(false);
    setErrorText('');
    setOtherMode(false);
    setOtherText('');
    setSavingImage(false);
    setAiMetrics([]);
  };

  const saveResultImage = async () => {
    if (!exportCardRef.current || savingImage) {
      return;
    }

    try {
      setSavingImage(true);
      const hasPermission = await requestPhotoSavePermission();
      if (!hasPermission) {
        Alert.alert('保存できませんでした', '写真への保存権限を許可してください。');
        return;
      }

      const uri = await captureRef(exportCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await CameraRoll.save(uri, {
        type: 'photo',
        album: '適職診断',
      });
      Alert.alert('保存しました', '診断結果を画像として保存しました。');
    } catch (error) {
      console.warn('careerFit result image save failed:', error);
      Alert.alert('保存できませんでした', '少し時間を置いてもう一度お試しください。');
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backBtnText}>＜ 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>適職診断</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
        <View style={styles.chatIntro}>
          <Text style={styles.chatIntroTitle}>AIと話しながら方向性を整理します</Text>
          <Text style={styles.chatIntroText}>返信は選択肢から選べます。合うものがないときだけ、その他で入力してください。</Text>
        </View>

        <View style={styles.messageList}>
          {messages.map(message => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'assistant' ? styles.assistantBubble : styles.userBubble,
              ]}
            >
              <Text style={[
                styles.messageText,
                message.role === 'assistant' ? styles.assistantText : styles.userText,
              ]}>
                {message.text}
              </Text>
            </View>
          ))}
          {loadingReply && (
            <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.loadingText}>考えています</Text>
            </View>
          )}
        </View>

        {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

        {!done && !loadingReply ? (
          <View style={styles.replyPanel}>
            <Text style={styles.replyPanelTitle}>返信を選択</Text>
            {choices.map(choice => (
              <TouchableOpacity
                key={choice}
                style={styles.choiceBtn}
                onPress={() => answerCurrentStep(choice)}
                accessibilityRole="button"
              >
                <Text style={styles.choiceText}>{choice}</Text>
              </TouchableOpacity>
            ))}

            {!otherMode ? (
              <TouchableOpacity
                style={styles.otherBtn}
                onPress={() => setOtherMode(true)}
                accessibilityRole="button"
              >
                <Text style={styles.otherBtnText}>その他を入力する</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.otherBox}>
                <TextInput
                  style={styles.otherInput}
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="自分の言葉で入力"
                  placeholderTextColor={C.muted}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.submitOtherBtn, !otherText.trim() && styles.submitOtherBtnDisabled]}
                  onPress={() => answerCurrentStep(otherText.trim())}
                  disabled={!otherText.trim()}
                  accessibilityRole="button"
                >
                  <Text style={styles.submitOtherText}>送信</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.doneActions}>
            <View ref={exportCardRef} collapsable={false} style={styles.resultExportCard}>
              <Text style={styles.resultEyebrow}>適職診断レポート</Text>
              <Text style={styles.resultTitle}>今回の診断結果</Text>
              <Text style={styles.resultDate}>{new Date().toLocaleDateString('ja-JP')}</Text>

              <View style={styles.feedbackBox}>
                <Text style={styles.sectionTitle}>AIフィードバック</Text>
                <Text style={styles.feedbackText}>{finalFeedback}</Text>
              </View>

              <View style={styles.chartBox}>
                <Text style={styles.sectionTitle}>傾向チャート</Text>
                {feedbackMetrics.map(metric => (
                  <View key={metric.label} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <View style={styles.metricTrack}>
                      <View style={[styles.metricFill, { width: `${metric.value}%` }]} />
                    </View>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.transcriptBox}>
                <Text style={styles.sectionTitle}>会話の記録</Text>
                {messages.map(message => (
                  <View key={`export_${message.id}`} style={styles.transcriptRow}>
                    <Text style={styles.transcriptRole}>{message.role === 'assistant' ? 'AI' : 'あなた'}</Text>
                    <Text style={styles.transcriptText}>{message.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveImageBtn, savingImage && styles.saveImageBtnDisabled]}
              onPress={saveResultImage}
              disabled={savingImage}
              accessibilityRole="button"
            >
              <Text style={styles.saveImageBtnText}>
                {savingImage ? '保存中...' : '診断結果を画像で保存'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restartBtn} onPress={restart}>
              <Text style={styles.restartBtnText}>最初から話す</Text>
            </TouchableOpacity>
            <View style={styles.answerList}>
              {Object.entries(answers).map(([key, value]) => (
                <View key={key} style={styles.answerRow}>
                  <Text style={styles.answerQuestion}>{CHAT_STEPS.find(s => s.id === key)?.message}</Text>
                  <Text style={styles.answerText}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function JobSupportHome({ onOpenCareerFit }: { onOpenCareerFit: () => void }) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.homeContent}>
      <View style={styles.header}>
        <Text style={styles.title}>就活サポート</Text>
      </View>

      <View style={styles.statusSection}>
        <HealthManagementScreen showOnly="stats" />
      </View>

      <TouchableOpacity
        style={styles.featureCard}
        onPress={onOpenCareerFit}
        accessibilityRole="button"
        accessibilityLabel="適職診断を開く"
      >
        <Text style={styles.featureTitle}>適職診断</Text>
      </TouchableOpacity>

      <View style={styles.checklistSection}>
        <HealthManagementScreen showOnly="missions" />
      </View>
    </ScrollView>
  );
}

export default function JobSupportScreen() {
  const [view, setView] = useState<SupportView>('home');

  if (view === 'career_fit') {
    return <CareerFitScreen onBack={() => setView('home')} />;
  }

  return <JobSupportHome onOpenCareerFit={() => setView('career_fit')} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  homeContent: {
    padding: 20,
  },
  header: {
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: C.text,
  },
  featureCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 132,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: C.primary,
    textAlign: 'center',
  },
  statusSection: {
    marginBottom: 20,
  },
  checklistSection: {
    marginTop: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 72,
    paddingVertical: 4,
  },
  backBtnText: {
    color: C.primary,
    fontSize: 15,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: C.text,
  },
  navSpacer: {
    width: 72,
  },
  scroll: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 28,
  },
  chatIntro: {
    backgroundColor: '#EBF0F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  chatIntroTitle: {
    fontSize: 15,
    color: C.primary,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  chatIntroText: {
    fontSize: 13,
    color: C.sub,
    lineHeight: 19,
  },
  messageList: {
    gap: 10,
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: C.sub,
    fontWeight: '600',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: C.primary,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    color: C.text,
  },
  userText: {
    color: C.card,
    fontWeight: '600',
  },
  replyPanel: {
    marginTop: 18,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 10,
  },
  replyPanelTitle: {
    fontSize: 12,
    color: C.sub,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 12,
    fontSize: 12,
    color: '#C62828',
    lineHeight: 18,
  },
  choiceBtn: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  choiceText: {
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
    lineHeight: 21,
  },
  otherBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  otherBtnText: {
    fontSize: 15,
    color: C.primary,
    fontWeight: 'bold',
  },
  otherBox: {
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  otherInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    backgroundColor: '#FAFAFA',
    lineHeight: 22,
  },
  submitOtherBtn: {
    marginTop: 10,
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitOtherBtnDisabled: {
    backgroundColor: '#C9D0D6',
  },
  submitOtherText: {
    color: C.card,
    fontSize: 15,
    fontWeight: 'bold',
  },
  doneActions: {
    marginTop: 16,
  },
  resultExportCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  resultEyebrow: {
    fontSize: 12,
    color: C.accent,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 22,
    color: C.text,
    fontWeight: 'bold',
  },
  resultDate: {
    marginTop: 4,
    fontSize: 12,
    color: C.sub,
  },
  feedbackBox: {
    marginTop: 16,
    backgroundColor: '#F7FAF7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D7E6D9',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 13,
    color: C.primary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 21,
    color: C.text,
  },
  chartBox: {
    marginTop: 14,
    backgroundColor: '#F6F8FB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE4EE',
    padding: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metricLabel: {
    width: 42,
    fontSize: 12,
    color: C.sub,
    fontWeight: 'bold',
  },
  metricTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DDE5EF',
    overflow: 'hidden',
  },
  metricFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  metricValue: {
    width: 32,
    textAlign: 'right',
    fontSize: 12,
    color: C.text,
    fontWeight: 'bold',
  },
  transcriptBox: {
    marginTop: 14,
    gap: 8,
  },
  transcriptRow: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  transcriptRole: {
    fontSize: 11,
    color: C.sub,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  transcriptText: {
    fontSize: 13,
    lineHeight: 19,
    color: C.text,
  },
  saveImageBtn: {
    marginTop: 14,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveImageBtnDisabled: {
    backgroundColor: '#A9B8AB',
  },
  saveImageBtnText: {
    color: C.card,
    fontSize: 15,
    fontWeight: 'bold',
  },
  answerList: {
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  answerRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  answerQuestion: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 18,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: C.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  restartBtn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  restartBtnText: {
    color: C.card,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
