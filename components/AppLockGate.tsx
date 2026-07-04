import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  authenticateWithBiometrics,
  isAppLockEnabled,
} from '../services/appLock';

// アプリロックが有効な場合、起動時とバックグラウンド復帰時に
// 生体認証（Face ID / 指紋認証など）でのロック解除を求めるゲート。

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  // null = 設定読み込み中（内容を一瞬でも表示しないため）
  const [locked, setLocked] = useState<boolean | null>(null);
  const lockedRef = useRef<boolean | null>(null);
  const authenticating = useRef(false);
  lockedRef.current = locked;

  const tryUnlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      const ok = await authenticateWithBiometrics();
      if (ok) setLocked(false);
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    isAppLockEnabled()
      .then(enabled => {
        if (enabled) {
          setLocked(true);
          tryUnlock();
        } else {
          setLocked(false);
        }
      })
      .catch(() => setLocked(false));
  }, [tryUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      // 認証プロンプト表示中は iOS では inactive になるため background のみ再ロック
      if (next === 'background' && !authenticating.current) {
        isAppLockEnabled()
          .then(enabled => {
            if (enabled) setLocked(true);
          })
          .catch(() => {});
      }
      if (next === 'active' && lockedRef.current === true) {
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  if (locked === null) {
    return <View style={s.blank} />;
  }

  if (locked) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.lockIcon}>🔒</Text>
          <Text style={s.title}>ロックされています</Text>
          <Text style={s.sub}>
            健康情報・就活情報を保護するため、{'\n'}生体認証でロックを解除してください。
          </Text>
          <TouchableOpacity
            style={s.unlockBtn}
            onPress={tryUnlock}
            accessibilityRole="button"
            accessibilityLabel="生体認証でロックを解除"
          >
            <Text style={s.unlockBtnText}>ロックを解除する</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  blank: { flex: 1, backgroundColor: '#F2EBE4' },
  root: { flex: 1, backgroundColor: '#F2EBE4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#304E78', marginBottom: 10 },
  sub: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  unlockBtn: {
    backgroundColor: '#304E78',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  unlockBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
