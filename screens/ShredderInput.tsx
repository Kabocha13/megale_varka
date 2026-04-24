import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ShredderInputProps = {
  onExpEarned?: (amount: number) => void;
  expAmount?: number;
  placeholder?: string;
  buttonLabel?: string;
};

type Phase = 'idle' | 'sliding' | 'fire' | 'ash' | 'done';

const MIN_TEXT_LENGTH = 10;
const DEFAULT_POSITIVE_TEXT =
  '全速全身だ！！';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function makeHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

async function mockGeminiReframeApi(_: string): Promise<string> {
  const delay = 1200 + Math.floor(Math.random() * 4200);
  await new Promise(resolve => setTimeout(() => resolve(undefined), delay));
  return DEFAULT_POSITIVE_TEXT;
}

export default function ShredderInput({
  onExpEarned,
  expAmount = 10,
  placeholder = 'ここに気持ちをぶちまけてください',
  buttonLabel = 'シュレッダーにかける',
}: ShredderInputProps) {
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [latestHash, setLatestHash] = useState<string | null>(null);

  const slideY = useRef(new Animated.Value(0)).current;
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const ashOpacity = useRef(new Animated.Value(0)).current;

  const canType = phase === 'idle' || phase === 'done';
  const normalized = useMemo(() => normalizeText(text), [text]);

  const startSlidePhase = () =>
    new Promise<void>(resolve => {
      setPhase('sliding');
      Animated.timing(slideY, {
        toValue: 220,
        duration: 3000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => resolve());
    });

  const startFirePhase = () =>
    new Promise<void>(resolve => {
      setPhase('fire');
      fireOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(fireOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(fireOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  const startAshPhase = () =>
    new Promise<void>(resolve => {
      setPhase('ash');
      ashOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(ashOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(ashOpacity, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  async function runShredderAnimation(): Promise<void> {
    await startSlidePhase();
    await startFirePhase();
    await startAshPhase();
    setPhase('done');
    slideY.setValue(0);
  }

  async function handleShred(): Promise<void> {
    if (isProcessing) {
      return;
    }

    setErrorMessage('');
    setFeedbackText('');

    if (!normalized) {
      setErrorMessage('入力をしてください');
      return;
    }

    if (normalized.length < MIN_TEXT_LENGTH) {
      setErrorMessage('もっとぶちまけていいよ');
      return;
    }

    const currentHash = makeHash(normalized);
    const isDuplicate = latestHash === currentHash;

    setIsProcessing(true);
    const loadingTimer = setTimeout(() => setShowSlowLoading(true), 3000);

    try {
      const [reframeText] = await Promise.all([
        mockGeminiReframeApi(normalized),
        runShredderAnimation(),
      ]);

      setFeedbackText(reframeText.slice(0, 150));

      if (!isDuplicate) {
        onExpEarned?.(expAmount);
      }

      setLatestHash(currentHash);
      setText('');
    } catch {
      setErrorMessage('通信に失敗しました。時間を空けて再試行してください。');
    } finally {
      clearTimeout(loadingTimer);
      setShowSlowLoading(false);
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inputWrap, { transform: [{ translateY: slideY }] }]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          multiline
          value={text}
          onChangeText={setText}
          editable={!isProcessing && canType}
          textAlignVertical="top"
          maxLength={500}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fireLayer, { opacity: fireOpacity }]}>
        <View style={[styles.flame, styles.flameLeft]} />
        <View style={[styles.flame, styles.flameCenter]} />
        <View style={[styles.flame, styles.flameRight]} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.ashLayer, { opacity: ashOpacity }]}>
        <Text style={styles.ashText}>灰になった...</Text>
      </Animated.View>

      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleShred}
        disabled={isProcessing}
      >
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </TouchableOpacity>

      {showSlowLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.loadingText}>再解釈メッセージを生成中...</Text>
        </View>
      )}

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      {!!feedbackText && <Text style={styles.feedbackText}>{feedbackText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#101418',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  inputWrap: {
    width: '100%',
  },
  input: {
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39424e',
    padding: 12,
    color: '#f5f6f7',
    backgroundColor: '#1b232d',
    fontSize: 15,
  },
  fireLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  flame: {
    width: 42,
    height: 72,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#ff7a00',
  },
  flameLeft: {
    transform: [{ rotate: '-8deg' }],
    backgroundColor: '#ff4d00',
  },
  flameCenter: {
    height: 86,
    backgroundColor: '#ff9f1a',
  },
  flameRight: {
    transform: [{ rotate: '8deg' }],
    backgroundColor: '#ff5f1f',
  },
  ashLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.25)',
  },
  ashText: {
    color: '#d2d2d2',
    fontSize: 18,
    fontWeight: '700',
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#8a2be2',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#d7dbdf',
    fontSize: 12,
  },
  errorText: {
    marginTop: 10,
    color: '#ff7b7b',
    fontWeight: '700',
  },
  feedbackText: {
    marginTop: 10,
    color: '#9be8b7',
    lineHeight: 20,
  },
});
