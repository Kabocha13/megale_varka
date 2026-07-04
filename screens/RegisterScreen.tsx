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

function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return 'パスワードは6文字以上で入力してください。';
  }
  if (!/[A-Z]/.test(password)) {
    return 'パスワードには大文字のアルファベットを含めてください。';
  }
  if (!/[a-z]/.test(password)) {
    return 'パスワードには小文字のアルファベットを含めてください。';
  }
  if (!/\d/.test(password)) {
    return 'パスワードには数字を含めてください。';
  }
  return null;
}

function RegisterScreen({ onNavigateToLogin }: Props) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('パスワードが条件を満たしていません', passwordError);
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password);
    } catch (error: unknown) {
      Alert.alert('エラー', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>新規登録</Text>

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

      <TextInput
        style={styles.input}
        placeholder="パスワード"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!submitting}
      />

      <Text style={[styles.passwordHint, password.length > 0 && validatePassword(password) !== null && styles.passwordHintError]}>
        パスワードは6文字以上で、大文字・小文字・数字をそれぞれ1文字以上含めてください
        {password.length > 0 && password.length < 6 ? `（あと${6 - password.length}文字）` : ''}
      </Text>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>登録する</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onNavigateToLogin} disabled={submitting}>
        <Text style={styles.link}>すでにアカウントをお持ちの方はこちら</Text>
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
    marginBottom: 40,
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
  passwordHint: {
    width: '100%',
    fontSize: 12,
    color: '#888888',
    marginTop: -8,
    marginBottom: 8,
  },
  passwordHintError: {
    color: '#E53935',
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
    backgroundColor: '#5A7693',
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

export default RegisterScreen;
