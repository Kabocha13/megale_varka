import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { APPLE_SIGNIN_ENABLED, DEMO_MODE } from '@env';
import { useAuth } from '../context/AuthContext';

const isDemoMode = DEMO_MODE === 'true';
// Sign in with Apple は有料の Apple Developer Program が必要なため、
// 加入して Xcode で capability を追加するまではフラグで無効化しておく
const appleSignInEnabled = APPLE_SIGNIN_ENABLED === 'true';

type Props = {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
};

function LoginScreen({ onNavigateToRegister, onNavigateToForgotPassword }: Props) {
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (error: unknown) {
      Alert.alert('エラー', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocialLogin(provider: 'google' | 'apple') {
    setSubmitting(true);
    try {
      if (provider === 'google') {
        await loginWithGoogle();
      } else {
        await loginWithApple();
      }
    } catch (error: unknown) {
      Alert.alert('エラー', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ログイン</Text>

      {isDemoMode && (
        <View style={styles.demoHint}>
          <Text style={styles.demoHintText}>
            デモモード: 任意のメール・パスワード（6文字以上）でログインできます
          </Text>
        </View>
      )}

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

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>ログイン</Text>
        )}
      </TouchableOpacity>

      <View style={styles.socialDividerRow}>
        <View style={styles.socialDividerLine} />
        <Text style={styles.socialDividerText}>または</Text>
        <View style={styles.socialDividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.socialButton, styles.googleButton, submitting && styles.socialButtonDisabled]}
        onPress={() => handleSocialLogin('google')}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Googleでログイン"
      >
        <Text style={styles.googleButtonText}>Googleでログイン</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && appleSignInEnabled && (
        <TouchableOpacity
          style={[styles.socialButton, styles.appleButton, submitting && styles.socialButtonDisabled]}
          onPress={() => handleSocialLogin('apple')}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Appleでログイン"
        >
          <Text style={styles.appleButtonText}>Appleでログイン</Text>
        </TouchableOpacity>
      )}

      <View style={styles.divider} />

      <TouchableOpacity onPress={onNavigateToForgotPassword} disabled={submitting} style={styles.forgotPassword}>
        <Text style={styles.link}>パスワードをお忘れの方はこちら</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNavigateToRegister} disabled={submitting}>
        <Text style={styles.link}>アカウントをお持ちでない方はこちら</Text>
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
  button: {
    width: '100%',
    backgroundColor: '#304E78',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#5A7696',
  },
  buttonText: {
    color: '#F2EBE4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 20,
  },
  socialDividerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  socialDividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#888888',
  },
  socialButton: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  googleButtonText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: 'bold',
  },
  appleButton: {
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  demoHint: {
    width: '100%',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  demoHintText: {
    color: '#92400e',
    fontSize: 13,
    lineHeight: 18,
  },
  forgotPassword: {
    marginBottom: 12,
  },
  link: {
    color: '#555555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
