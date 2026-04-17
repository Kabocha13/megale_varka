import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

type Props = {
  onNavigateToLogin: () => void;
};

function ForgotPasswordScreen({ onNavigateToLogin }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert('エラー', 'メールアドレスを入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      Alert.alert(
        '送信完了',
        'パスワードリセット用のメールを送信しました。メールをご確認ください。',
        [{ text: 'OK', onPress: onNavigateToLogin }],
      );
    } catch (error: unknown) {
      Alert.alert('エラー', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>パスワードリセット</Text>
      <Text style={styles.description}>
        登録済みのメールアドレスを入力してください。パスワードリセット用のメールをお送りします。
      </Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>送信する</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onNavigateToLogin} disabled={submitting}>
        <Text style={styles.link}>ログイン画面に戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F2EBE4',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#304E78',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#304E78',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#7A9BBD',
  },
  buttonText: {
    color: '#F2EBE4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    color: '#555555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default ForgotPasswordScreen;
